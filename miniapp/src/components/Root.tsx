import { TonConnectUIProvider } from '@tonconnect/ui-react';

import { App } from '@/components/App.tsx';
import { ErrorBoundary } from '@/components/ErrorBoundary.tsx';
import { publicUrl } from '@/helpers/publicUrl.ts';

function ErrorBoundaryError({ error }: { error: unknown }) {
  const debugMessage = import.meta.env.DEV
    ? (error instanceof Error
      ? `${error.name}: ${error.message}`
      : typeof error === 'string'
        ? error
        : 'Non-Error exception thrown')
    : null;

  return (
    <div role="alert" style={{ padding: 16 }}>
      <p>Something went wrong while loading this mini app.</p>
      <button type="button" onClick={() => window.location.reload()}>
        Reload Mini App
      </button>
      {debugMessage ? (
        <pre style={{ marginTop: 12, whiteSpace: 'pre-wrap' }}>{debugMessage}</pre>
      ) : null}
    </div>
  );
}

export function Root() {
  return (
    <ErrorBoundary fallback={ErrorBoundaryError}>
      <TonConnectUIProvider
        manifestUrl={publicUrl('tonconnect-manifest.json')}
      >
        <App/>
      </TonConnectUIProvider>
    </ErrorBoundary>
  );
}
