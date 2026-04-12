import type { StoredRepair } from "@/lib/repair-store";
import type { StoredTemplate } from "@/lib/template-store";
import type { StoredWorkflowStage } from "@/lib/workflow-stage-store";

export function resolveStageTemplateAutomation(
  stageName: string,
  workflowStages: StoredWorkflowStage[],
  templates: StoredTemplate[]
) {
  const stage = workflowStages.find((item) => item.name === stageName);
  if (!stage?.templateAutomationEnabled || !stage.templateId) return null;
  const template = templates.find((item) => item.id === stage.templateId);
  if (!template) return null;
  return { stage, template };
}

function resolveRepairField(repair: StoredRepair, field?: string) {
  if (field === "customerName") return repair.customerName;
  if (field === "customerPhone") return repair.customerPhone;
  if (field === "assetName") return repair.assetName;
  if (field === "title") return repair.title;
  if (field === "description") return repair.description;
  if (field === "stage") return repair.stage;
  if (field === "priority") return repair.priority;
  return "";
}

export function buildTemplateVariableDefaults(template: StoredTemplate, repair: StoredRepair) {
  return (template.variables ?? []).map((variable) =>
    variable.mode === "repair_field" ? resolveRepairField(repair, variable.repairField) : variable.manualValue ?? ""
  );
}

export function fillTemplateBody(template: StoredTemplate, variableValues: string[]) {
  return template.body.replace(/\{\{\s*(\d+)\s*\}\}/g, (match, rawIndex) => {
    const value = variableValues[Number(rawIndex) - 1];
    return value && value.trim().length > 0 ? value : match;
  });
}

export function buildTemplateMessageWithButtons(body: string, buttons: StoredTemplate["buttons"] = []) {
  const formattedButtons = (buttons ?? [])
    .map((button, index) => {
      const text = button.text.trim() || `Button ${index + 1}`;
      return `• ${text}`;
    })
    .join("\n");

  return formattedButtons.length > 0 ? `${body}\n\nButtons:\n${formattedButtons}` : body;
}

export function buildScheduledSendAtIso(stage: StoredWorkflowStage) {
  if (!stage.templateSendDelayEnabled) return undefined;
  const delayHours = Math.max(0, stage.templateSendDelayHours ?? 0);
  const delayMinutes = Math.max(0, stage.templateSendDelayMinutes ?? 0);
  const totalDelayMinutes = delayHours * 60 + delayMinutes;
  if (totalDelayMinutes <= 0) return undefined;
  return new Date(Date.now() + totalDelayMinutes * 60 * 1000).toISOString();
}
