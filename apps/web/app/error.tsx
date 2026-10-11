'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="page-enter">
      <h1>Something interrupted this view.</h1>
      <p>Please try loading it again.</p>
      <button className="primary-button" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
