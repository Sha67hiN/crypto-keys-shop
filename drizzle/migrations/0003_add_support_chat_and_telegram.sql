ALTER TABLE public.site_settings
  ADD COLUMN telegram_handle text,
  ADD COLUMN support_hours text;

CREATE TABLE public.support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  sender text NOT NULL CHECK (sender IN ('user', 'admin')),
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_by_admin boolean NOT NULL DEFAULT false,
  read_by_user boolean NOT NULL DEFAULT false
);
CREATE INDEX support_messages_user_idx ON public.support_messages (user_id, created_at);
GRANT SELECT, INSERT, UPDATE ON public.support_messages TO authenticated;
GRANT ALL ON public.support_messages TO service_role;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own messages read" ON public.support_messages FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own messages send" ON public.support_messages FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND sender = 'user');
CREATE POLICY "admins read messages" ON public.support_messages FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins write messages" ON public.support_messages FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;
