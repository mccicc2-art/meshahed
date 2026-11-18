/**
 * ====== 🆕 T414 — أشكالُ ما يعبر السلك إلى «المشهد» (الترحيبُ العريض على الويب وحدَه) ======
 *
 * ⚖️ **هنا لا في `core/contracts`**: التطبيقُ لا يقرؤها (ورقتُه `EpisodeSheet` أرقامٌ تُضغط)، وعقدٌ مشتركٌ لا يقرؤه إلّا طرفٌ
 * واحدٌ يعِد بما لا يُستعمل. وملفٌّ عاديٌّ لا `"use client"`: المسارُ على الخادم يستورد منه نوعاً.
 */

/** حلقةٌ في شريط «أين وصلت» — `episode` هو الرقمُ الذي يُكتب (`first + i`، يصحّ في الترقيم المطلق كـOne Piece) */
export type SceneEpisode = { episode: number; name: string | null; still: string | null };

/** `GET /api/v1/welcome/episodes?id=&season=` */
export type SceneEpisodesPayload = { id: number; season: number; episodes: SceneEpisode[] };
