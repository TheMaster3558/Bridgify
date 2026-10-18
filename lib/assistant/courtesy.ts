/** Keep acknowledgments quiet without hiding requests that happen to say thanks. */
export function isCourtesyOnly(text: string): boolean {
  const trimmed = text.trim();
  if (/^(?:[👍🙏🙌✅]\uFE0F?\s*)+$/u.test(trimmed)) return true;
  const words = trimmed
    .toLowerCase()
    .replace(/[\p{P}\p{S}\uFE0F]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  return /^(?:(?:ok|okay|great|awesome|got it) )?(?:thanks(?: a lot| so much| for the update)?|thank you(?: very much| so much| for the update)?|much appreciated|appreciate it)$/.test(words);
}
