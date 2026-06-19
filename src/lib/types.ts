export interface Book {
  id: number;
  created_at: string;
  title: string;
  author: string;
  pages: number;
  progress: number;
  status: "reading" | "completed" | string;
  cover_url?: string | null;
  rating?: number | null;
  user_id?: string | null;
  genre?: string | null;
  published_year?: number | null;
  summary?: string | null;
  notes?: string | null;
}

export interface ReadingLog {
  id: number;
  created_at?: string;
  book_id: number;
  date: string;
  pages_read: number;
  end_page: number;
  user_id?: string | null;
}
