interface PaginationProps {
  offset: number;
  limit: number;
  hasNext: boolean;
  onChange: (offset: number) => void;
}

export function Pagination({
  offset,
  limit,
  hasNext,
  onChange,
}: PaginationProps) {
  const page = Math.floor(offset / limit) + 1;
  const canPrevious = offset > 0;

  return (
    <div className="pagination">
      <button
        className="button button-secondary"
        disabled={!canPrevious}
        onClick={() => onChange(Math.max(0, offset - limit))}
      >
        ← Previous
      </button>

      <span className="pagination-page">
        Page {page}
      </span>

      <button
        className="button button-secondary"
        disabled={!hasNext}
        onClick={() => onChange(offset + limit)}
      >
        Next →
      </button>
    </div>
  );
}
