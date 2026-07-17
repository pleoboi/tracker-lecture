import { NextRequest, NextResponse } from "next/server";
import { sendPushToUser, adminSupabase } from "../../../../lib/push.server";

const GOAL_REACHED_MESSAGES = (pagesRead: number): string[] => [
  `Objectif du jour bouclé avec ${pagesRead} pages. Et si tu allais encore plus loin ce soir ?`,
  `Tu as dépassé ton quota aujourd'hui. La soirée est encore longue — quelques pages de plus ?`,
  `${pagesRead} pages aujourd'hui, objectif atteint. Les meilleurs lecteurs ne s'arrêtent pas là.`,
  `Bien joué, objectif atteint ! Tu peux t'arrêter là. Ou pas.`,
  `Tu as cartonné aujourd'hui avec ${pagesRead} pages. Ton livre mérite encore quelques minutes.`,
  `Objectif coché. Si tu continues ce soir, tu seras en avance sur toute la semaine.`,
  `${pagesRead} pages, mission accomplie. Mais une dernière session ne ferait pas de mal.`,
  `Tu as fini ton objectif avant même la fin de la journée. Impressionnant. Encore un chapitre ?`,
];

const PROGRESS_MESSAGES = (remaining: number, pagesRead: number): string[] => [
  `Il te reste ${remaining} pages pour atteindre ton objectif du jour.`,
  `Tu es à ${pagesRead} pages aujourd'hui — encore ${remaining} pour finir la journée en beauté.`,
  `${remaining} pages et tu boucles ton objectif. Ce soir, c'est possible !`,
  `Tu es si proche. Plus que ${remaining} pages pour ton objectif quotidien.`,
];

const NO_GOAL_MESSAGES = (pagesRead: number): string[] =>
  pagesRead > 0
    ? [
        `Tu as lu ${pagesRead} pages aujourd'hui. Définis un objectif annuel pour aller encore plus loin.`,
        `${pagesRead} pages ce soir, pas mal. Et si tu te fixais un cap pour cette année ?`,
        `Bonne session aujourd'hui. Un objectif annuel te permettrait de voir ta progression sur la durée.`,
        `Tu lis, c'est l'essentiel. Pense à renseigner ton objectif annuel pour suivre ton rythme.`,
      ]
    : [
        "Pas encore de livre ouvert ce soir ? C'est le meilleur moment pour commencer.",
        "La soirée commence. Quelques pages suffisent pour entretenir l'habitude.",
        "Ton livre t'attend. Lance-toi, même 5 minutes comptent.",
        "Ouvre ton application, choisis un livre, lis une page. Le reste vient tout seul.",
        "Les grandes habitudes commencent par de petits gestes. Ce soir, c'est une page.",
        "Tu n'as pas encore de lecture en cours ? C'est le bon moment pour en commencer une.",
      ];

const NO_READ_MESSAGES = [
  "Pas encore ouvert ton livre aujourd'hui ? Il est encore temps ce soir !",
  "Ton livre te manque, non ? Il est là, il attend.",
  "Les meilleures soirées commencent par quelques pages. Lance-toi !",
  "Même 10 pages ce soir font la différence. Tu peux le faire !",
  "Juste quelques pages avant de dormir ? Ton objectif t'attend.",
  "Ta série de lectures a besoin de toi ce soir.",
  "Un livre ouvert ce soir, et ta journée est complète.",
  "Ce soir, le meilleur moment pour lire commence maintenant.",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization")?.replace("Bearer ", "")
    ?? req.nextUrl.searchParams.get("secret");
  if (auth !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date().toISOString().split("T")[0];

  const { data: subs } = await adminSupabase
    .from("user_push_subscriptions")
    .select("user_id");

  if (!subs?.length) return NextResponse.json({ sent: 0 });

  const userIds = [...new Set((subs as { user_id: string }[]).map((s) => s.user_id))];

  const { data: goals } = await adminSupabase
    .from("user_goals")
    .select("user_id, reading_pages_year")
    .in("user_id", userIds)
    .not("reading_pages_year", "is", null);

  const goalsMap = new Map(
    (goals ?? [] as { user_id: string; reading_pages_year: number }[]).map((g) => [
      g.user_id,
      g.reading_pages_year,
    ]),
  );

  const { data: todayLogs } = await adminSupabase
    .from("reading_logs")
    .select("user_id, pages_read")
    .in("user_id", userIds)
    .eq("date", today);

  const todayMap = new Map<string, number>();
  for (const log of (todayLogs ?? [] as { user_id: string; pages_read: number }[])) {
    todayMap.set(log.user_id, (todayMap.get(log.user_id) ?? 0) + log.pages_read);
  }

  let sent = 0;
  await Promise.all(
    userIds.map(async (uid) => {
      const pagesRead = todayMap.get(uid) ?? 0;
      const pagesYear = goalsMap.get(uid);

      if (pagesYear) {
        const dailyGoal = Math.ceil(pagesYear / 365);

        if (pagesRead >= dailyGoal) {
          await sendPushToUser(uid, { title: "Swena", body: pick(GOAL_REACHED_MESSAGES(pagesRead)) });
          sent++;
          return;
        }

        if (pagesRead > 0) {
          const remaining = dailyGoal - pagesRead;
          await sendPushToUser(uid, { title: "Swena", body: pick(PROGRESS_MESSAGES(remaining, pagesRead)) });
          sent++;
          return;
        }

        // objectif défini mais rien lu aujourd'hui
        await sendPushToUser(uid, { title: "Swena", body: pick(NO_READ_MESSAGES) });
        sent++;
        return;
      }

      // pas d'objectif annuel défini — motiver quand même
      await sendPushToUser(uid, { title: "Swena", body: pick(NO_GOAL_MESSAGES(pagesRead)) });
      sent++;
    }),
  );

  return NextResponse.json({ sent });
}
