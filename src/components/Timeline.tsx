"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { TimelineEvent, TimelineEventType } from "@/types";
import { TypeBadge } from "@/components/Badge";

type FilterKey = "all" | TimelineEventType;

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "auteur", label: "新品" },
  { key: "win", label: "获奖" },
  { key: "nomination", label: "入围" },
  { key: "streaming", label: "流媒体" },
];
