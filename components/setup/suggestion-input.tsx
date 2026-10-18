"use client";

import { useId, useMemo, useState, type ComponentProps } from "react";
import { Input } from "@/components/ui/input";

const CURRENCIES = Intl.supportedValuesOf("currency");
const TIME_ZONES = Intl.supportedValuesOf("timeZone");
const MATCH_LIMIT = 12;

const COMMON_CURRENCIES = [
  "USD",
  "EUR",
  "GBP",
  "CAD",
  "AUD",
  "NZD",
  "JPY",
  "CHF",
];

const COMMON_TIME_ZONES = [
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "UTC",
  "Europe/London",
  "Europe/Paris",
  "Asia/Tokyo",
];

function suggestions(
  options: readonly string[],
  query: string,
  common: readonly string[],
) {
  const needle = query.trim().toLowerCase();
  if (!needle) return common;
  const matches: string[] = [];
  for (const option of options) {
    if (option.toLowerCase().includes(needle)) {
      matches.push(option);
      if (matches.length === MATCH_LIMIT) break;
    }
  }
  return matches;
}

function SuggestInput({
  options,
  common,
  defaultValue,
  onChange,
  ...props
}: ComponentProps<typeof Input> & {
  options: readonly string[];
  common: readonly string[];
}) {
  const listId = useId().replace(/:/g, "");
  const [query, setQuery] = useState(
    typeof defaultValue === "string" || typeof defaultValue === "number"
      ? String(defaultValue)
      : "",
  );
  const shown = useMemo(
    () => suggestions(options, query, common),
    [options, common, query],
  );
  return (
    <>
      <Input
        autoComplete="off"
        {...props}
        defaultValue={defaultValue}
        list={listId}
        onChange={(event) => {
          setQuery(event.target.value);
          onChange?.(event);
        }}
      />
      <datalist id={listId}>
        {shown.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
    </>
  );
}

export function CurrencyInput(
  props: Omit<ComponentProps<typeof SuggestInput>, "options" | "common">,
) {
  return (
    <SuggestInput {...props} options={CURRENCIES} common={COMMON_CURRENCIES} />
  );
}

export function TimeZoneInput(
  props: Omit<ComponentProps<typeof SuggestInput>, "options" | "common">,
) {
  return (
    <SuggestInput {...props} options={TIME_ZONES} common={COMMON_TIME_ZONES} />
  );
}
