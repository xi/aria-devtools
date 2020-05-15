import {
  AOMElement,
  AomKey,
  AomNodeRelations,
  HtmlID,
  NodeElement,
  TextElement,
  Aria,
  Context,
  HtmlTableContext,
  AriaTableContext
} from "../AOM/types";
import { action, observable } from "mobx";
import { getMap, reconcileChildListOrder, reconcileFields } from "../AOM/reconcile";

class RelationsForId {
  @observable elementsWithId: NonNullable<NodeElement>[] = [];
  @observable ariaLabelOf: NonNullable<NodeElement>[] = [];
  @observable ariaOwnedBy: NonNullable<NodeElement>[] = [];
  @observable ariaActiveDescendantOf: NonNullable<NodeElement>[] = [];
  @observable htmlLabel: NonNullable<NodeElement>[] = [];
}

interface Alert {
  source: NodeElement;
  ariaLive: "polite" | "assertive";
  content: string;
}

export default class Store {
  private keyToAomElement = new Map<AomKey, AOMElement>();
  private idToRelations = new Map<HtmlID, RelationsForId>();

  private focusedNode: NodeElement | null = null;
  private activeDescendantNode: NodeElement | null = null;
  @observable activeAlerts: Alert[] = [];

  @action focus(element: AOMElement) {
    if (this.focusedNode && this.focusedNode !== element) {
      this.focusedNode.isFocused = false;
      for (let node: NodeElement | null = this.focusedNode; node != null; node = node.ariaParent) {
        node.containsFocus = false;
      }
      this.focusedNode = null;
    }

    if (this.focusedNode !== element && element instanceof NodeElement) {
      element.isFocused = true;
      this.focusedNode = element;

      for (let node: NodeElement | null = element; node != null; node = node.ariaParent) {
        node.containsFocus = true;
        node.relations.tableContext?.showCellWithNode(node);
      }
    }

    const descendants = this.focusedNode && this.focusedNode.relations.ariaActiveDescendants;
    const activeDescendant = descendants?.length && descendants[0];

    if (activeDescendant && activeDescendant !== this.activeDescendantNode) {
      activeDescendant.relations.tableContext?.showCellWithNode(activeDescendant);
      this.activeDescendantNode = activeDescendant;
    }
  }

  @action addActiveAlarm(node: NodeElement) {
    const alertText = node.children
      .map((x: AOMElement) => x?.accessibleName ?? "")
      .join(" ")
      .trim();

    if (!alertText) {
      return;
    }

    const activeAlert = this.activeAlerts.length > 0 ? this.activeAlerts[0] : null;
    if (activeAlert?.source?.key === node.key && activeAlert.content === alertText) {
      return;
    }

    this.clearActiveAlarm(node);

    const alert = {
      source: node,
      content: alertText,
      ariaLive: node.attributes.ariaLive as "polite" | "assertive"
    };

    if (node.attributes.ariaLive === "assertive") {
      this.activeAlerts.splice(0, this.activeAlerts.length, alert);
    } else if (node.attributes.ariaLive === "polite") {
      this.activeAlerts.push(alert);
    }
  }

  @action clearActiveAlarm(node: NodeElement) {
    const index = this.activeAlerts.findIndex(x => x.source.key === node.key);

    if (index === -1) {
      return;
    }

    this.activeAlerts.splice(index, 1);
  }

  register(element: AOMElement) {
    if (!element) {
      return;
    }

    if (this.keyToAomElement.has(element.key)) {
      console.error("Duplicated element in registerElement", element);
      throw new Error("Duplicated element in registerElement: " + element.key);
    }

    this.keyToAomElement.set(element.key, element);

    if (element instanceof NodeElement) {
      this.updateReferenceRelations(element, null, element.attributes);
      this.setContext(element, "formContext", "form", "input");
      this.setContext(element, "labelContext", "label", "input", "textarea");
      this.setContext(element, "fieldsetContext", "fieldset", "legend");
      this.setAriaLiveContext(element);
      this.setTableContext(element);

      element.htmlChildren.forEach(item => item && this.register(item));

      if (element.isFocused) {
        this.focus(element);
      }

      if (element.relations.ariaLiveContext?.root) {
        this.addActiveAlarm(element.relations.ariaLiveContext.root);
      }
    }

    return element;
  }

  update(update: NonNullable<AOMElement>, updatedNodes = new Set<AOMElement>()) {
    const el = this.getElement(update.key);

    if (!el) {
      return;
    }

    if (updatedNodes.has(el)) {
      return;
    }

    if (el instanceof TextElement && update instanceof TextElement) {
      reconcileFields(el, update, ["text"]);

      if (el.ariaParent?.relations.ariaLiveContext?.root) {
        this.addActiveAlarm(el.ariaParent?.relations.ariaLiveContext?.root);
      }

      return;
    }

    if (!(el instanceof NodeElement) || !(update instanceof NodeElement)) {
      console.log(el, update);
      throw new Error("Invariant issue: typeof");
    }

    this.updateReferenceRelations(el, el.attributes, update.attributes);

    reconcileFields(el, update, ["isHidden", "isInline"]);

    reconcileFields(el.getRawAttributes(), update.getRawAttributes());
    reconcileFields(el.getRawProperties(), update.getRawProperties());

    const targetMap = getMap(el.htmlChildren);
    const sourceMap = getMap(update.htmlChildren);

    // Disconnect deleted children from store
    targetMap.forEach(node => {
      if (!sourceMap.has(node.key)) {
        node.htmlParent = null;
        this.unregister(node);
      }
    });

    // Register new children in store
    sourceMap.forEach(node => {
      const target = targetMap.get(node.key);
      if (target) {
        this.update(node);
        if (target instanceof TextElement && node instanceof TextElement && target.text !== node.text) {
        }
      } else {
        node.htmlParent = el;
        this.register(node);
      }
    });

    reconcileChildListOrder(el.htmlChildren, update.htmlChildren, this);

    if (el.relations.ariaLiveContext?.root) {
      this.addActiveAlarm(el.relations.ariaLiveContext?.root);
    }

    if (update.isFocused) {
      this.focus(el);
    }

    updatedNodes.add(el);
  }

  unregister(element: AOMElement) {
    if (!element) {
      return;
    }

    if (element instanceof NodeElement) {
      this.clearActiveAlarm(element);
      this.updateReferenceRelations(element, element.attributes, null);
      element.relations.formContext = null;
      element.relations.labelContext = null;
      element.relations.fieldsetContext = null;
      element.relations.ariaLiveContext = null;
      element.relations.tableContext = null;

      element.htmlChildren.forEach(item => item && this.unregister(item));

      if (element.isFocused) {
        this.focus(null);
      }
    }

    this.keyToAomElement.delete(element.key);
  }

  getElement(key?: AomKey) {
    return key ? this.keyToAomElement.get(key) : null;
  }

  private updateReferenceRelations(node: NodeElement, oldAttributes: Aria | null, newAttributes: Aria | null) {
    if (oldAttributes?.id !== newAttributes?.id) {
      if (oldAttributes?.id) {
        removeFrom(this.getRelationsForId(oldAttributes?.id).elementsWithId, node);
        node.relations.ariaLabelOf = [];
        node.relations.ariaActiveDescendantOf = [];
        node.relations.ariaOwnedBy = [];
        node.relations.htmlForLabelledBy = [];
      }

      if (newAttributes?.id) {
        const rel = this.getRelationsForId(newAttributes?.id);

        rel.elementsWithId.push(node);
        node.relations.ariaLabelOf = rel.ariaLabelOf;
        node.relations.ariaActiveDescendantOf = rel.ariaActiveDescendantOf;
        node.relations.ariaOwnedBy = rel.ariaOwnedBy;
        node.relations.htmlForLabelledBy = rel.htmlLabel;
      }
    }

    this.updateSingleReferenceRelation(
      node,
      oldAttributes?.ariaLabelledBy,
      newAttributes?.ariaLabelledBy,
      "ariaLabelledBy",
      "ariaLabelOf"
    );

    this.updateSingleReferenceRelation(
      node,
      oldAttributes?.ariaActiveDescendant,
      newAttributes?.ariaActiveDescendant,
      "ariaActiveDescendants",
      "ariaActiveDescendantOf"
    );

    this.updateSingleReferenceRelation(
      node,
      oldAttributes?.ariaOwns,
      newAttributes?.ariaOwns,
      "ariaOwns",
      "ariaOwnedBy"
    );

    this.updateSingleReferenceRelation(
      node,
      oldAttributes?.htmlFor,
      newAttributes?.htmlFor,
      "htmlForLabelOf",
      "htmlLabel"
    );
  }

  private updateSingleReferenceRelation(
    node: NodeElement,
    oldValue: HtmlID | undefined,
    newValue: HtmlID | undefined,
    ownRelationName: keyof AomNodeRelations,
    foreignRelationName: keyof RelationsForId
  ) {
    if (oldValue === newValue) {
      return;
    }

    if (oldValue) {
      removeFrom(this.getRelationsForId(oldValue)[foreignRelationName], node);
      // @ts-ignore
      node.relations[ownRelationName] = [];
    }

    if (newValue) {
      const relation = this.getRelationsForId(newValue);
      relation[foreignRelationName].push(node);
      // @ts-ignore
      node.relations[ownRelationName] = relation.elementsWithId;
    }
  }

  private getRelationsForId(id: HtmlID): RelationsForId {
    let result = this.idToRelations.get(id);

    if (!result) {
      result = new RelationsForId();
      this.idToRelations.set(id, result);
    }

    return result;
  }

  private setContext(
    node: NodeElement,
    contextName: "formContext" | "labelContext" | "fieldsetContext",
    rootTag: string,
    ...memberTags: string[]
  ) {
    if (node.htmlTag === rootTag) {
      node.relations[contextName] = new Context(node);
    } else if (!node.htmlParent) {
      node.relations[contextName] = new Context(null);
    } else {
      node.relations[contextName] = node.htmlParent.relations[contextName];
    }

    if (memberTags.includes(node.htmlTag)) {
      node.relations[contextName]?.descendants.push(node);
    }
  }

  private setTableContext(node: NodeElement) {
    if (node.htmlTag === "table") {
      node.relations.tableContext = new HtmlTableContext(node);
    } else if (node.role === "table" || node.role === "grid") {
      node.relations.tableContext = new AriaTableContext(node);
    } else if (node.htmlParent) {
      node.relations.tableContext = node.htmlParent.relations.tableContext;
    }
  }

  private setAriaLiveContext(node: NodeElement) {
    if (node.attributes.ariaLive !== "off") {
      node.relations.ariaLiveContext = new Context(node);
    } else if (node.htmlParent) {
      node.relations.ariaLiveContext = node.htmlParent.relations.ariaLiveContext;
    }
  }
}

const removeFrom = (array: NodeElement[] | undefined, node: NodeElement) => {
  if (!array) return;
  const index = array.indexOf(node);

  if (index !== -1) {
    array.splice(index, 1);
  }
};