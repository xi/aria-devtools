import styled from "styled-components";
import React from "react";
import { borderRadius, focusStyle } from "./utils";
import { renderContext, ComponentProps } from "./utils";
import { trimStart } from "../../AOM/utils";
import { observer } from "mobx-react";

const color = "#ab8900";

const HeadingWrapper = styled.div<{ isHovered: boolean }>`
  margin: 15px 0 10px 0;
  border-radius: ${borderRadius};
  ${props => props.isHovered && `background: ${color}`};
`;

const Role = styled.div`
  display: inline-block;
  text-transform: uppercase;
  background: ${color};
  border-radius: ${borderRadius};
  margin: 0 10px 0 0;
  padding: 0 5px;
  border: 1px solid transparent;
  opacity: 0.8;
  cursor: pointer;

  ${HeadingWrapper}:hover & {
    border-color: white;
    opacity: 1;
  }
`;

export interface HorizontalBlockTemplateProps {
  header: string;
  children: any;
  style?: object;
}

export function HorizontalBlockTemplate({
  header,
  children,
  style
}: HorizontalBlockTemplateProps) {
  const [isHovered, setHovered] = React.useState(false);

  return (
    <HeadingWrapper isHovered={isHovered} style={style}>
      <Role
        onMouseOver={() => setHovered(true)}
        onMouseOut={() => setHovered(false)}
      >
        {header}
      </Role>
      {children}
    </HeadingWrapper>
  );
}

export default observer(function Heading({ node }: ComponentProps) {
  const render = React.useContext(renderContext);

  return (
    <HorizontalBlockTemplate
      header={`${node.role} ${node.attributes.ariaLevel}`}
    >
      {render(trimStart(node.htmlChildren))}
    </HorizontalBlockTemplate>
  );
});
