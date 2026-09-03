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
  // Identifiant "œuvre" Open Library (ex: "OL82563W") — regroupe toutes les
  // éditions/traductions d'un même livre, contrairement à l'ISBN qui est
  // propre à une édition. Sert à détecter les doublons multilingues à l'import.
  openlibrary_work_id?: string | null;
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
