import Link from 'next/link';
export default function NotFound() {
  return (
    <div>
      <p className="eyebrow">404 · PAGE NOT FOUND</p>
      <h1>This trail ends here.</h1>
      <Link className="primary-button" href="/">
        Back to overview
      </Link>
    </div>
  );
}
