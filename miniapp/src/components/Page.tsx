import { useNavigate } from 'react-router-dom';
import { backButton } from '@tma.js/sdk-react';
import { type PropsWithChildren, useEffect } from 'react';

export function Page({ children, back = true }: PropsWithChildren<{
  /**
   * True if it is allowed to go back from this page.
   */
  back?: boolean
}>) {
  const navigate = useNavigate();

  useEffect(() => {
    if (back) {
      backButton.show.ifAvailable();
      const off = backButton.onClick.isAvailable()
        ? backButton.onClick(() => {
          navigate(-1);
        })
        : undefined;
      return () => {
        off?.();
        backButton.hide.ifAvailable();
      };
    }
    backButton.hide.ifAvailable();
    return undefined;
  }, [back, navigate]);

  return <>{children}</>;
}
