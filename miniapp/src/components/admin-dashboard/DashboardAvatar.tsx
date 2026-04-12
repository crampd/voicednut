type DashboardAvatarProps = {
  src: string;
  alt: string;
  fallback: string;
};

export function DashboardAvatar({
  src,
  alt,
  fallback,
}: DashboardAvatarProps) {
  if (src) {
    return (
      <img
        className="va-profile-avatar-img"
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
      />
    );
  }
  return <span className="va-profile-avatar-fallback" aria-hidden>{fallback}</span>;
}
