
"use client";

import { useState, useEffect } from 'react';

export function CurrentYear() {
  const [year, setYear] = useState<number | null>(null);

  useEffect(() => {
    // This code only runs on the client, after the component has mounted.
    setYear(new Date().getFullYear());
  }, []);

  // By returning the year state, we ensure that on the initial server render
  // and the initial client render, the output is consistent (nothing is rendered
  // as `year` is null). The actual year is only rendered on the client after
  // the component has mounted and the `useEffect` hook has run.
  return <>{year}</>;
}
