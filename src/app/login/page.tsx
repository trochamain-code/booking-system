import { login } from "@/lib/actions";
import { PasswordField } from "../password-field";
import { SubmitButton } from "@/app/submit-button";
import { CalendarIcon } from "@/app/icons";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="canvas-glow flex min-h-full items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-on-primary shadow-[var(--shadow-md)]">
            <CalendarIcon className="h-7 w-7" />
          </div>
          <h1 className="text-3xl font-semibold text-ink">Iniciar sesión</h1>
          <p className="mt-1 text-sm text-muted">Gestiona tus reservas y tu widget.</p>
        </div>
        <form action={login} className="card space-y-4 p-6 shadow-[var(--shadow-md)]">
          {error && (
            <p role="alert" className="rounded-xl bg-danger-bg px-3 py-2 text-sm text-danger">
              {error === "rate"
                ? "Demasiados intentos. Espera un momento e inténtalo de nuevo."
                : "Correo o contraseña no válidos."}
            </p>
          )}
          <div>
            <label className="label" htmlFor="email">
              Correo electrónico
            </label>
            <input id="email" name="email" type="email" required autoComplete="email" className="input" />
          </div>
          <div>
            <label className="label" htmlFor="password">
              Contraseña
            </label>
            <PasswordField id="password" name="password" required />
          </div>
          <SubmitButton className="btn btn-primary w-full" pendingText="Entrando…">
            Entrar
          </SubmitButton>
        </form>
      </div>
    </main>
  );
}
