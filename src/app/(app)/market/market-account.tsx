"use client";

import { WfmConnect, useWfmStatus } from "@/components/wfm-connect";

export function MarketAccount() {
  const { status, refresh } = useWfmStatus();
  return <WfmConnect status={status} onChange={refresh} />;
}
