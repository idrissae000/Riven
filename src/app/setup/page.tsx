export const metadata = { title: "Setup" };

export default function SetupPage() {
  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <div className="card-glow">
        <h1 className="h-display mb-2 text-3xl">Connect Supabase</h1>
        <p className="mb-4 text-dim">
          Warframe Economist needs a Supabase project. Copy <code className="text-teal">.env.example</code> to{" "}
          <code className="text-teal">.env.local</code>, fill in the values, then restart the dev server.
        </p>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-dim">
          <li>Create a project at supabase.com.</li>
          <li>Run the SQL in <code className="text-teal">supabase/migrations/</code> (SQL editor, or <code className="text-teal">supabase db push</code>).</li>
          <li>Set <code className="text-teal">NEXT_PUBLIC_SUPABASE_URL</code>, <code className="text-teal">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>, <code className="text-teal">SUPABASE_SERVICE_ROLE_KEY</code>.</li>
          <li>Run <code className="text-teal">npm run sync:wfm-static</code> to load weapons and riven stats.</li>
        </ol>
      </div>
    </main>
  );
}
