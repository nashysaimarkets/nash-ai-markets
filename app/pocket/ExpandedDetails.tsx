"use client";
import { Children, cloneElement, isValidElement, type ComponentProps, type ReactNode } from 'react';

/** Native disclosure: visible on arrival, collapsible by its summary. */
export default function ExpandedDetails({ children, className = '', ...props }: Omit<ComponentProps<'details'>, 'open'>) {
  return <details {...props} open className={`psExpandedDetails ${className}`}>{Children.map(children, child =>
    isValidElement<{ children?: ReactNode }>(child) && child.type === 'summary'
      ? cloneElement(child, {}, child.props.children, <b className="psDisclosureControl"><span className="psDisclosureHide">Hide</span><span className="psDisclosureShow">Show</span></b>)
      : child
  )}</details>;
}
