import {InterfacesUnion} from './utilityTypes';

// when executing either create new message (only thread_id will be present)
// https://platform.openai.com/docs/api-reference/messages/createMessage
// or when creating and running together
// https://platform.openai.com/docs/api-reference/runs/createThreadAndRun
export interface OpenAIAssistantInitReqResult {
  id: string; // run id
  thread_id: string;
  error?: {code: string; message: string};
}

export interface OpenAINewAssistantResult {
  id: string;
}

export interface OpenAIAssistantContent {
  image_file?: {file_id: string};
  text?: {value: string; annotations?: {text?: string; file_path?: {file_id?: string}}[]};
}

export interface OpenAIAssistantData {
  // https://platform.openai.com/docs/api-reference/messages/object
  content: OpenAIAssistantContent[];
}

export interface OpenAIAssistantMessagesResult {
  data: OpenAIAssistantData[];
}

export interface OpenAIRunResult {
  status: string;
  thread_id: string;
  required_action?: {
    submit_tool_outputs?: {
      tool_calls?: ToolCalls;
    };
  };
}

export type ToolCalls = {function: {name: string; arguments: string}; id: string}[];

export interface ToolAPI {
  tool_calls?: ToolCalls;
  tool_call_id?: string;
  name?: string;
}

export type OpenAIMessage = {
  role: 'user' | 'system' | 'ai' | 'tool';
  content: string;
} & ToolAPI;

export type OpenAITextToSpeechResult = Blob | {error?: {code: string; message: string}};

// text for completion request & stream
// message for chat completion request
// delta for chat completion stream
type ResultChoice = InterfacesUnion<{text: string} | {message: OpenAIMessage} | {delta: OpenAIMessage}>;

export interface OpenAIConverseResult {
  choices: ResultChoice[];
  usage: {total_tokens: number};
  error?: {code: string; message: string};
}

export interface OpenAIImageResult {
  data: InterfacesUnion<{url: string} | {b64_json: string}>[];
  error?: {code: string; message: string};
}

export interface OpenAIAudioResult {
  text: string;
  error?: {code: string; message: string};
}
