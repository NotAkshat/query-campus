export interface ScrapedDocument {
  url: string;
  title: string;
  content: string;
  type: 'html' | 'pdf';
}
