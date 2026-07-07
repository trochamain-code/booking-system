import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-full items-center justify-center p-6">
      <div className="card max-w-md p-8 text-center">
        <p className="text-sm font-semibold text-muted">404</p>
        <h1 className="mt-1 text-2xl font-semibold text-ink">Página no encontrada</h1>
        <p className="mt-2 text-sm text-muted">
          El enlace no existe o la reserva ya no está disponible.
        </p>
        <Link href="/" className="btn btn-primary mt-6 inline-flex">
          Volver al inicio
        </Link>
      </div>
    </main>
  );
}
