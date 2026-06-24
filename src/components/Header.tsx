import React from 'react';
import { logoBase64 } from '../assets/logo';

interface HeaderProps {
  title?: string;
}

export const Header: React.FC<HeaderProps> = ({ title = 'QUOTATION' }) => {
  return (
    <div className="header-box">
      <div className="header-top">
        <div className="logo">
          <div className="estd-left">Est. 1983</div>
          <img alt="Krishi Vikas Udyog Logo" src={logoBase64} />
        </div>
        <div className="company-center">
          <div className="estd">{title}</div>
          <h1>
            KRISHI VIKAS UDYOG<span className="reg-sym">®</span>
          </h1>
          <div className="iso">◆ An ISO 9001 : 2015 Certified Co. ◆</div>
          <div className="tagline">
            A Range Of Food Processing & Agricultural Equipment
          </div>
          <div className="sub">MUBARAKPUR TANDA AMBEDKAR NAGAR - 224190</div>
          <div className="sub">www.krishivikasudyog.in</div>
        </div>
      </div>
      <div className="header-bottom">
        <span>
          <b>Mob.No.:</b> 9415139837, 9415139838 &nbsp;&nbsp;&nbsp; 
          <b>E-mail:</b>{' '}
          <a
            href="mailto:kvu.tanda@gmail.com"
            style={{ color: 'inherit', textDecoration: 'none' }}
          >
            kvu.tanda@gmail.com
          </a>
        </span>
        <span className="gstn">GSTN: &nbsp; 09AADFK7950N1ZP</span>
      </div>
    </div>
  );
};
