import React from 'react';
import { CONTACT_ROWS } from '../../data/portfolio';

const Contact: React.FC = () => (
  <>
    <div className="animate-in d1 eyebrow" style={{ marginTop: 20 }}>Contact</div>
    <h2 className="animate-in d2 contact-big">
      Let&apos;s build<br /><em>something</em> real.
    </h2>
    <div className="animate-in d3 contact-rows">
      {CONTACT_ROWS.map(r => (
        <a className="contact-row" href={r.href} key={r.label}>
          <span className="l">{r.label}</span>
          <span className="v">{r.value} &rarr;</span>
        </a>
      ))}
    </div>
  </>
);

export default Contact;
