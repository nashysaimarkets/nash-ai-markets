export const VALID_TREASURY_YIELD_CURVE_XML = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom"
      xmlns:d="http://schemas.microsoft.com/ado/2007/08/dataservices"
      xmlns:m="http://schemas.microsoft.com/ado/2007/08/dataservices/metadata">
  <entry>
    <content type="application/xml">
      <m:properties>
        <d:NEW_DATE m:type="Edm.DateTime">2026-08-08T00:00:00</d:NEW_DATE>
        <d:BC_2YEAR m:type="Edm.Double">3.70</d:BC_2YEAR>
        <d:BC_10YEAR m:type="Edm.Double">4.15</d:BC_10YEAR>
        <d:BC_30YEAR m:type="Edm.Double">4.76</d:BC_30YEAR>
      </m:properties>
    </content>
  </entry>
  <entry>
    <content type="application/xml">
      <m:properties>
        <d:NEW_DATE m:type="Edm.DateTime">2026-08-10T00:00:00</d:NEW_DATE>
        <d:BC_2YEAR m:type="Edm.Double">3.72</d:BC_2YEAR>
        <d:BC_10YEAR m:type="Edm.Double">4.21</d:BC_10YEAR>
        <d:BC_30YEAR m:type="Edm.Double">4.82</d:BC_30YEAR>
      </m:properties>
    </content>
  </entry>
</feed>`;

export const MISSING_30Y_TREASURY_XML = `<?xml version="1.0"?>
<feed xmlns:d="http://schemas.microsoft.com/ado/2007/08/dataservices"
      xmlns:m="http://schemas.microsoft.com/ado/2007/08/dataservices/metadata">
  <entry><content><m:properties>
    <d:NEW_DATE>2026-08-10T00:00:00</d:NEW_DATE>
    <d:BC_2YEAR>3.72</d:BC_2YEAR>
    <d:BC_10YEAR>4.21</d:BC_10YEAR>
  </m:properties></content></entry>
</feed>`;

export const MALFORMED_10Y_TREASURY_XML = `<?xml version="1.0"?>
<feed xmlns:d="http://schemas.microsoft.com/ado/2007/08/dataservices"
      xmlns:m="http://schemas.microsoft.com/ado/2007/08/dataservices/metadata">
  <entry><content><m:properties>
    <d:NEW_DATE>2026-08-10T00:00:00</d:NEW_DATE>
    <d:BC_2YEAR>3.72</d:BC_2YEAR>
    <d:BC_10YEAR>not-a-number</d:BC_10YEAR>
    <d:BC_30YEAR>4.82</d:BC_30YEAR>
  </m:properties></content></entry>
</feed>`;

export const OLDER_TREASURY_YIELD_CURVE_XML = `<?xml version="1.0"?>
<feed xmlns:d="http://schemas.microsoft.com/ado/2007/08/dataservices"
      xmlns:m="http://schemas.microsoft.com/ado/2007/08/dataservices/metadata">
  <entry><content><m:properties>
    <d:NEW_DATE>2026-08-01T00:00:00</d:NEW_DATE>
    <d:BC_2YEAR>3.65</d:BC_2YEAR>
    <d:BC_10YEAR>4.11</d:BC_10YEAR>
    <d:BC_30YEAR>4.73</d:BC_30YEAR>
  </m:properties></content></entry>
</feed>`;
