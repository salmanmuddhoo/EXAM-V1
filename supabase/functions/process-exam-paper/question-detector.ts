export interface QuestionGroup {
  questionNumber: string;
  pageNumbers: number[];
  fullText: string;   // merged OCR text
}

export class QuestionDetector {
  // Detects lines that begin with "1 ", "2 ", "3 " etc. at start of line
  private mainQuestionPattern = /^(?:\s*)(\d{1,2})(?=\s)/m;

  detectAndGroupQuestions(pagesWithOCR: Array<{ pageNumber: number; ocrText: string }>): QuestionGroup[] {
    const groups: QuestionGroup[] = [];
    let currentQuestion: QuestionGroup | null = null;

    for (const page of pagesWithOCR) {
      const lines = page.ocrText.split("\n");

      for (const line of lines) {
        const match = line.match(this.mainQuestionPattern);

        if (match) {
          // Start a new main question
          if (currentQuestion) {
            groups.push(currentQuestion);
          }

          currentQuestion = {
            questionNumber: match[1],   // e.g. "1", "2"
            pageNumbers: [page.pageNumber],
            fullText: line.trim(),
          };
        } else if (currentQuestion) {
          // Belongs to the current question
          if (!currentQuestion.pageNumbers.includes(page.pageNumber)) {
            currentQuestion.pageNumbers.push(page.pageNumber);
          }
          currentQuestion.fullText += "\n" + line.trim();
        }
      }
    }

    if (currentQuestion) {
      groups.push(currentQuestion);
    }

    return groups;
  }

  // Detect a question number from user query like "question 2"
  parseQuestionNumberFromQuery(query: string): string | null {
    const match = query.match(/(?:question|q|Q\.?)\s*(\d+)/i);
    if (match && match[1]) {
      return match[1].trim();
    }
    return null;
  }
}
