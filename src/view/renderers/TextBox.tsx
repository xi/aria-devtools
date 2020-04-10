import styled, { css } from "styled-components";
import React from "react";
import { borderRadius } from "./utils";
import { ComponentProps } from "./utils";
import { observer } from "mobx-react";
import { HorizontalBlockTemplate } from "./Heading";
import { getFocusStyle } from "./Option";

const TextBoxContent = styled.span<{ multiline: boolean; invalid: boolean }>`
  display: block;
  margin-top: 5px;
  padding: 3px 5px;
  background: transparent;
  border: 1px solid ${props => (props.invalid ? "#c33" : "#aaa")};
  width: fit-content;
  min-width: 200px;

  border-radius: ${borderRadius};
  white-space: pre-wrap;
  ${props => props.multiline && "min-height: 40px; width: auto;"};
`;

const HeaderPart = styled.span`
  cursor: pointer;
  :hover {
    background: #555;
  }
`;

const ValidityIcon = styled.span<{ invalid: boolean }>`
  display: inline-block;
  transform-origin: center center;
  transition: transform 0.3s ease-in;
  transform: ${props =>
    props.invalid
      ? `rotate(180deg) translateY(-1px)`
      : `rotate(0) translate(0)`};

  ::before {
    content: "👍";
  }
`;

export default observer(function TextBox({ node }: ComponentProps) {
  return (
    <HorizontalBlockTemplate header={"textbox"}>
      <HeaderPart>{node.accessibleName}</HeaderPart>{" "}
      <HeaderPart>
        {node.attributes.ariaRequired && "⭐"}{" "}
        <ValidityIcon invalid={node.attributes.ariaInvalid} />
      </HeaderPart>
      <TextBoxContent
        multiline={node.attributes.ariaMultiline}
        invalid={node.attributes.ariaInvalid}
        style={getFocusStyle(node)}
      >
        {node.attributes.htmlValue}&nbsp;
      </TextBoxContent>
    </HorizontalBlockTemplate>
  );
});
