export interface QuestionSource {
  prompt: string;
  answer: string;
  wrong: [string, string, string];
}
