CALL {
MATCH (product)
WHERE (product:Interface OR (product:Class AND product.isAbstract = true))
  AND EXISTS { MATCH (product)-[:IN_FILE]->() }

MATCH (creatorType:Type)-[:DECLARES]->(fm:Method)
      -[:RETURN_TYPE]->(productType:Type {fqn: product.fqn})
WHERE creatorType.fqn <> product.fqn
  AND coalesce(fm.isStatic, false) = false
  AND coalesce(fm.isSynthetic, false) = false

MATCH (cc)-[:IMPLEMENTS|EXTENDS*1..3]->(creatorNode)
WHERE (cc:Class OR cc:Interface)
  AND creatorNode.fqn = creatorType.fqn
  AND cc.fqn <> creatorType.fqn

// RELAXED: CC má metódu s rovnakým RETURN_TYPE → Product (bez OVERRIDES)
MATCH (ccType:Type {fqn: cc.fqn})-[:DECLARES]->(ccMethod:Method)
      -[:RETURN_TYPE]->(ccRetType:Type {fqn: product.fqn})
WHERE coalesce(ccMethod.isStatic, false) = false

MATCH (ccMethod)-[:CREATES]->(cpType:Type)

WHERE EXISTS {
  MATCH (cpNode)-[:IMPLEMENTS|EXTENDS*1..3]->(product)
  WHERE cpNode.fqn = cpType.fqn
}

WITH DISTINCT creatorType, product, fm
SET creatorType:FactoryMethodCreator
}
