import {EventSourceMessage, fetchEventSource} from '@microsoft/fetch-event-source';
import {MessageStream} from '../../views/chat/messages/stream/messageStream';
import {ServiceIO, StreamHandlers} from '../../services/serviceIO';
import {Messages} from '../../views/chat/messages/messages';
import {Response as ResponseI} from '../../types/response';
import {Stream as StreamI} from '../../types/stream';
import {CustomHandler} from './customHandler';
import {RequestUtils} from './requestUtils';
import {Demo} from '../demo/demo';

type SimulationSH = Omit<StreamHandlers, 'abortStream'> & {abortStream: {abort: () => void}};

type UpsertFunc = (response?: ResponseI) => MessageStream | void;

export class Stream {
  // prettier-ignore
  public static async request(io: ServiceIO, body: object, messages: Messages, stringifyBody = true) {
    const requestDetails = {body, headers: io.requestSettings?.headers};
    const {body: interceptedBody, headers: interceptedHeaders, error} =
      (await RequestUtils.processRequestInterceptor(io.deepChat, requestDetails));
    const {onOpen, onClose, abortStream} = io.streamHandlers;
    if (error) return RequestUtils.onInterceptorError(messages, error, onClose);
    if (io.requestSettings?.handler) return CustomHandler.stream(io, interceptedBody, messages);
    if (io.requestSettings?.url === Demo.URL) return Demo.requestStream(messages, io.streamHandlers);
    const stream = new MessageStream(messages);
    fetchEventSource(io.requestSettings?.url || io.url || '', {
      method: io.requestSettings?.method || 'POST',
      headers: interceptedHeaders,
      credentials: io.requestSettings?.credentials,
      body: stringifyBody ? JSON.stringify(interceptedBody) : interceptedBody,
      openWhenHidden: true, // keep stream open when browser tab not open
      async onopen(response: Response) {
        if (response.ok) {
          return onOpen();
        }
        const result = await RequestUtils.processResponseByType(response);
        throw result;
      },
      async onmessage(message: EventSourceMessage) {
        if (JSON.stringify(message.data) !== JSON.stringify('[DONE]')) {
          let eventData: object;
          try {
            eventData = JSON.parse(message.data);
          } catch(e) {
            eventData = {};
          }
          const finalEventData = (await io.deepChat.responseInterceptor?.(eventData)) || eventData;
          io.extractResultData?.(finalEventData)
            .then((result?: ResponseI) => {
              // do not to stop the stream on one message failure to give other messages a change to display
              Stream.upsertWFiles(messages, stream.upsertStreamedMessage.bind(stream), stream, result);
            })
            .catch((e) => RequestUtils.displayError(messages, e));
        }
      },
      onerror(err) {
        onClose();
        throw err; // need to throw otherwise stream will retry infinitely
      },
      onclose() {
        stream.finaliseStreamedMessage();
        onClose();
      },
      signal: abortStream.signal,
    }).catch((err) => {
      // allowing extractResultData to attempt extract error message and throw it
      io.extractResultData?.(err)
        .then(() => {
          RequestUtils.displayError(messages, err);
        })
        .catch((parsedError) => {
          RequestUtils.displayError(messages, parsedError);
        });
    });
  }

  public static simulate(messages: Messages, sh: StreamHandlers, result: ResponseI) {
    const simulationSH = sh as unknown as SimulationSH;
    // reason for not streaming html is because there is no standard way to split it
    if (result.files || result.html) messages.addNewMessage({sendUpdate: false, ignoreText: true, ...result}, false);
    if (result.text) {
      sh.onOpen();
      const responseText = result.text.split(''); // important to split by char for Chinese characters
      Stream.populateMessages(responseText, new MessageStream(messages), simulationSH);
    }
  }

  private static populateMessages(responseText: string[], stream: MessageStream, sh: SimulationSH, charIndex = 0) {
    const character = responseText[charIndex];
    if (character) {
      stream.upsertStreamedMessage({text: character});
      const timeout = setTimeout(() => {
        Stream.populateMessages(responseText, stream, sh, charIndex + 1);
      }, sh.simulationInterim || 6);
      sh.abortStream.abort = () => {
        Stream.abort(timeout, stream, sh.onClose);
      };
    } else {
      stream.finaliseStreamedMessage();
      sh.onClose();
    }
  }

  public static isSimulation(stream?: StreamI) {
    return typeof stream === 'object' && !!stream.simulation;
  }

  public static isSimulatable(stream?: StreamI, respone?: ResponseI) {
    return Stream.isSimulation(stream) && respone && (respone.text || respone.html);
  }

  private static abort(timeout: number, stream: MessageStream, onClose: () => void) {
    clearTimeout(timeout);
    stream.finaliseStreamedMessage();
    onClose();
  }

  public static upsertWFiles(messages: Messages, upsert: UpsertFunc, stream?: MessageStream, response?: ResponseI) {
    if (response?.text || response?.html) {
      const resultStream = upsert(response);
      stream ??= resultStream || undefined; // when streaming with websockets - created per message due to roles
    }
    if (response?.files) {
      messages.addNewMessage({files: response.files});
      stream?.markFileAded();
    }
  }
}
