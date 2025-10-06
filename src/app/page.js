export default function Home() {
  return (
    <main className="p-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-blue-600">Snap2Invoice</h1>
        <nav className="flex gap-4 mt-2">
          <a href="/upload" className="text-blue-500 hover:underline">Upload Receipt</a>
          <a href="/invoices" className="text-blue-500 hover:underline">View Invoices</a>
          <a href="/account" className="text-blue-500 hover:underline">Account</a>
        </nav>
      </header>
      <section>
        <p>Snap a receipt, get an invoice. Simple, fast, and automated.</p>
      </section>
    </main>
  );
}
