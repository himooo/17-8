// ====================================================================
//  seed-demo-lesson.ts v1.0
//
//  Ensures the user has a real, comprehensive demo curriculum on first
//  run. If the DB has no imported lessons, we fetch the bundled
//  master-test-lesson.html (a Pattern-2 lesson with 4 ideas, embedded
//  SVG figures, KaTeX math, interactive questions, virtual comments)
//  and push it to the DB as an ImportedLesson.
//
//  Safe to call repeatedly — it no-ops once the user has any lesson.
// =================================================================///

import { localDb } from "./local-db";
import { extractManifestFromHTML } from "./shell-utils";

const DEMO_LESSON_URL = "/slides/master-test-lesson.html";
const DEMO_LESSON_ID = "lesson_demo_master_test";
const SEED_FLAG_KEY = "bisalasa-demo-lesson-seeded";

export async function seedDemoLessonIfEmpty(): Promise<void> {
  if (typeof window === "undefined") return;

  // Only attempt seeding once per browser to avoid re-fetching on every mount.
  if (window.localStorage.getItem(SEED_FLAG_KEY)) return;

  try {
    const existing = await localDb.lessons.list();
    if (existing.length > 0) {
      // User already has lessons — don't seed.
      window.localStorage.setItem(SEED_FLAG_KEY, "1");
      return;
    }

    const resp = await fetch(DEMO_LESSON_URL, { cache: "no-store" });
    if (!resp.ok) {
      console.warn(`[seedDemoLesson] fetch failed: ${resp.status}`);
      return;
    }
    const html = await resp.text();
    const manifest = extractManifestFromHTML(html);

    await localDb.lessons.upsert({
      lessonId: DEMO_LESSON_ID,
      fileName: "master-test-lesson.html",
      title: manifest?.title ?? "المنهج التجريبي الشامل",
      subtitle: manifest?.subtitle ?? "درس شامل لاختبار جميع أدوات بسلاسة",
      content: html,
      manifestJson: manifest ? JSON.stringify(manifest) : "{}",
    });

    window.localStorage.setItem(SEED_FLAG_KEY, "1");
    console.info("[seedDemoLesson] Seeded master-test-lesson into DB.");
  } catch (e) {
    console.warn("[seedDemoLesson] seeding failed:", e);
  }
}
