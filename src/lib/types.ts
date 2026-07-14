export interface Book {
  id: number;
  created_at: string;
  title: string;
  author: string;
  pages: number;
  progress: number;
  status: "reading" | "completed" | "abandoned" | "to-read" | "paused" | string;
  cover_url?: string | null;
  rating?: number | null;
  user_id?: string | null;
  genre?: string | null;
  published_year?: number | null;
  summary?: string | null;
  notes?: string | null;
  date_read?: string | null;
  date_started?: string | null;
  import_source?: string | null;
  isbn13?: string | null;
}

export interface Follow {
  id: number;
  follower_id: string;
  following_id: string;
  created_at: string;
}

export interface ReadSession {
  id: number;
  book_id: number;
  user_id: string;
  date_started: string | null;
  date_read: string | null;
  created_at: string;
}

export interface ReadingLog {
  id: number;
  created_at?: string;
  book_id: number;
  date: string;
  pages_read: number;
  end_page: number;
  user_id?: string | null;
  session_notes?: string | null;
  session_photo_url?: string | null;
}
