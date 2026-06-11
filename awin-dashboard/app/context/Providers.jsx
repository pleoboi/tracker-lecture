'use client';

import { DataProvider } from './DataContext';

export default function Providers({ children }) {
  return <DataProvider>{children}</DataProvider>;
}
