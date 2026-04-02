export default function LoginPage() {
  return (
    <main className="mx-auto mt-20 max-w-md space-y-4 card">
      <h1 className="text-xl font-semibold">Sign in</h1>
      <input className="input" placeholder="Email" />
      <input className="input" placeholder="Password" type="password" />
      <button className="btn w-full">Sign in</button>
    </main>
  );
}
