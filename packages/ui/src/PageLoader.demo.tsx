import React from 'react';
import PageLoader from './PageLoader';

export const meta = {
  title: 'PageLoader',
  description: 'Full-screen spinner with optional caption.',
  variants: ['default', 'with-text'],
};

export default function PageLoaderDemo() {
  return <PageLoader text="Loading…" />;
}
