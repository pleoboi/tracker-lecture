-- Migration v8 : index de performance pour le podium et la comparaison duel
-- À exécuter dans Supabase > SQL Editor

-- Accélère les requêtes PodiumModal (filtre par date précise, agrège les pages par user)
CREATE INDEX IF NOT EXISTS idx_reading_logs_date
  ON reading_logs (date);

-- Accélère le chargement des logs d'un ami (duel comparison) et les requêtes "mon historique"
CREATE INDEX IF NOT EXISTS idx_reading_logs_user_date
  ON reading_logs (user_id, date);

-- Accélère les requêtes de graphiques mensuels filtrées par user + plage de dates
CREATE INDEX IF NOT EXISTS idx_reading_logs_user_date_pages
  ON reading_logs (user_id, date, pages_read);

-- Accélère la récupération des livres complétés par un ami (duel)
CREATE INDEX IF NOT EXISTS idx_books_user_status
  ON books (user_id, status);
