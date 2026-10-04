export default function Home() {
  return (
    <main>
      <header><span className="mark" aria-hidden="true">CS</span><span>Card Selling</span><span className="mode">Local workspace</span></header>
      <section className="intro">
        <p className="eyebrow">YOUR COLLECTION, YOUR DECISIONS</p>
        <h1>Make the next sale count.</h1>
        <p className="lead">Compare selling options, prepare card batches, and keep track of what you own.</p>
      </section>
      <section className="empty" aria-labelledby="inventory-heading">
        <div className="card-symbol" aria-hidden="true">◇</div>
        <div><h2 id="inventory-heading">No inventory imported yet</h2><p>Your collection will appear here after the source inventory has been reconciled.</p></div>
      </section>
      <footer>Private inventory stays on this computer.</footer>
    </main>
  );
}
