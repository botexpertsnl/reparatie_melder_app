import { normalizeButtonReplyText } from "@/lib/workflows/button-reply-normalizer";

type TemplateButtonLike = {
  text: string;
};

type TemplateLike = {
  id: string;
  buttons?: TemplateButtonLike[];
};

export type ButtonTextUniquenessValidation = {
  duplicateWithinTemplateIndexes: Set<number>;
  duplicateAcrossTemplatesIndexes: Set<number>;
};

export function normalizeButtonTextForUniqueness(value: string): string {
  return normalizeButtonReplyText(value);
}

export function validateButtonTextUniqueness(params: {
  buttons: TemplateButtonLike[];
  templates: TemplateLike[];
  currentTemplateId?: string;
}): ButtonTextUniquenessValidation {
  const duplicateWithinTemplateIndexes = new Set<number>();
  const duplicateAcrossTemplatesIndexes = new Set<number>();

  const indexesByNormalizedText = new Map<string, number[]>();
  params.buttons.forEach((button, index) => {
    const normalizedText = normalizeButtonTextForUniqueness(button.text);
    if (!normalizedText) return;

    const existing = indexesByNormalizedText.get(normalizedText) ?? [];
    existing.push(index);
    indexesByNormalizedText.set(normalizedText, existing);
  });

  for (const indexes of indexesByNormalizedText.values()) {
    if (indexes.length <= 1) continue;
    indexes.forEach((index) => duplicateWithinTemplateIndexes.add(index));
  }

  const usedByOtherTemplates = new Set<string>();
  params.templates.forEach((template) => {
    if (params.currentTemplateId && template.id === params.currentTemplateId) return;

    (template.buttons ?? []).forEach((button) => {
      const normalizedText = normalizeButtonTextForUniqueness(button.text);
      if (!normalizedText) return;
      usedByOtherTemplates.add(normalizedText);
    });
  });

  params.buttons.forEach((button, index) => {
    const normalizedText = normalizeButtonTextForUniqueness(button.text);
    if (!normalizedText) return;

    if (usedByOtherTemplates.has(normalizedText)) {
      duplicateAcrossTemplatesIndexes.add(index);
    }
  });

  return {
    duplicateWithinTemplateIndexes,
    duplicateAcrossTemplatesIndexes
  };
}
