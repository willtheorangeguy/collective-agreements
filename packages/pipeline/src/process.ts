import { eq } from "drizzle-orm";
import { db, agreements, aiAnalyses, revisions } from "@collective/db";
import { analysisToEditable } from "@collective/shared";
import { createAnalyzer, PROMPT_VERSION } from "@collective/ai";
import { extractText } from "./extract.js";
import { getFile } from "./storage.js";

export interface ProcessResult {
  ok: boolean;
  error?: string;
}

export async function processAgreement(agreementId: string): Promise<ProcessResult> {
  try {
    const [agreement] = await db.select().from(agreements).where(eq(agreements.id, agreementId));
    if (!agreement) throw new Error(`agreement not found: ${agreementId}`);

    let text = agreement.extractedText;
    let language = agreement.detectedLanguage;
    if (!text) {
      if (!agreement.fileKey) throw new Error("agreement has no file");
      const buf = await getFile(agreement.fileKey);
      const extracted = await extractText(buf, agreement.mimeType ?? "application/pdf");
      text = extracted.text;
      await db
        .update(agreements)
        .set({ extractedText: text })
        .where(eq(agreements.id, agreementId));
    }

    const analyzer = createAnalyzer();
    const result = await analyzer.analyze(text ?? "");

    const [analysisRow] = await db
      .insert(aiAnalyses)
      .values({
        agreementId,
        provider: analyzer.provider,
        model: analyzer.model,
        promptVersion: PROMPT_VERSION,
        rawResponse: result.raw as Record<string, unknown>,
        structured: result.analysis,
        tokensIn: result.tokensIn,
        tokensOut: result.tokensOut,
      })
      .returning();

    const [revision] = await db
      .insert(revisions)
      .values({
        agreementId,
        editorId: null,
        isAi: true,
        fields: analysisToEditable(result.analysis),
        editSummary: `AI analysis (${analyzer.provider}/${analyzer.model})`,
        status: "approved",
      })
      .returning();

    await db
      .update(agreements)
      .set({
        status: "published",
        aiAnalysisId: analysisRow.id,
        currentRevisionId: revision.id,
        detectedLanguage: result.analysis.language || language,
        countries: result.analysis.country_codes.length > 0 ? result.analysis.country_codes : agreement.countries,
        updatedAt: new Date(),
      })
      .where(eq(agreements.id, agreementId));

    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(agreements)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(agreements.id, agreementId))
      .catch(() => {});
    return { ok: false, error: message };
  }
}
