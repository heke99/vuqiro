import { mockPackageVersions, mockStoreProducts } from "@vuqiro/mock-data";

export default function MonetizationPage() {
  return (
    <>
      <div className="header">
        <div>
          <div className="kicker">Monetization</div>
          <h1>Packages, pricing and store mapping</h1>
          <p className="copy">Superadmin can create global package versions, map Apple/Google/RevenueCat products, configure creator share and control publication status. Mobile checkout prices must come from the stores/RevenueCat.</p>
        </div>
        <button className="button">Create draft version</button>
      </div>
      <div className="grid-3">
        <div className="card"><div className="metric">Creator tiers</div><div className="metric-value">3</div></div>
        <div className="card"><div className="metric">Coin packs</div><div className="metric-value">4</div></div>
        <div className="card"><div className="metric">Store mappings</div><div className="metric-value">{mockStoreProducts.length}</div></div>
      </div>
      <div className="card" style={{ marginTop: 18 }}>
        <div className="row"><h2>Price versions</h2><span className="badge warning">Draft changes create new versions</span></div>
        <table className="table">
          <thead><tr><th>Package</th><th>Price</th><th>Billing</th><th>Creator share</th><th>Status</th></tr></thead>
          <tbody>
            {mockPackageVersions.map((version) => (
              <tr key={version.id}>
                <td><strong>{version.displayName}</strong><br />{version.description}</td>
                <td>{version.currency} {version.priceAmount}</td>
                <td>{version.billingPeriod}</td>
                <td>{version.creatorSharePercent}%</td>
                <td><span className="badge secondary">{version.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card" style={{ marginTop: 18 }}>
        <div className="row"><h2>Store products</h2><button className="button ghost">Add store product</button></div>
        <table className="table">
          <thead><tr><th>Platform</th><th>Product ID</th><th>RevenueCat Offering</th><th>Entitlement</th><th>Status</th></tr></thead>
          <tbody>
            {mockStoreProducts.map((product) => (
              <tr key={product.id}>
                <td>{product.platform}</td>
                <td><strong>{product.storeProductId}</strong></td>
                <td>{product.revenueCatOfferingId ?? "—"}</td>
                <td>{product.revenueCatEntitlementId ?? "—"}</td>
                <td><span className={product.status === "missing" ? "badge danger" : "badge secondary"}>{product.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
