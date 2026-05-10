CALL {
MATCH (product)
WHERE (product:Interface OR (product:Class AND product.isAbstract = true))
  AND EXISTS { MATCH (product)-[:IN_FILE]->() }

MATCH (creatorType:Type)-[:DECLARES]->(fm:Method)
      -[:RETURN_TYPE]->(productType:Type {fqn: product.fqn})
WHERE creatorType.fqn <> product.fqn
  AND coalesce(fm.isStatic, false) = false
  AND coalesce(fm.isSynthetic, false) = false
  // Naming/abstract filter
  AND (
    fm.isAbstract = true
    OR toLower(fm.name) STARTS WITH "create"
    OR toLower(fm.name) STARTS WITH "make"
    OR toLower(fm.name) STARTS WITH "new"
    OR toLower(fm.name) STARTS WITH "build"
    OR toLower(fm.name) STARTS WITH "factory"
    OR toLower(fm.name) STARTS WITH "produce"
    OR toLower(fm.name) STARTS WITH "construct"
  )

MATCH (cc)-[:IMPLEMENTS|EXTENDS*1..3]->(creatorNode)
WHERE (cc:Class OR cc:Interface)
  AND creatorNode.fqn = creatorType.fqn
  AND cc.fqn <> creatorType.fqn

// Strict OVERRIDES
MATCH (ccType:Type {fqn: cc.fqn})-[:DECLARES]->(ccMethod:Method)
      -[:OVERRIDES]->(fm)

MATCH (ccMethod)-[:CREATES]->(cpType:Type)

WHERE EXISTS {
  MATCH (cpNode)-[:IMPLEMENTS|EXTENDS*1..3]->(product)
  WHERE cpNode.fqn = cpType.fqn
}

WITH
  creatorType,
  product,
  fm,
  collect(DISTINCT cc.fqn) AS concreteCreatorFqns,
  collect(DISTINCT cpType.fqn) AS concreteProductFqns,
  collect(DISTINCT ccMethod.name) AS concreteCreatorMethods

WITH DISTINCT creatorType, product, fm, concreteCreatorFqns, concreteProductFqns

SET creatorType:FactoryMethod

RETURN DISTINCT
  creatorType,
  product,
  fm,
  concreteCreatorFqns,
  concreteProductFqns
}

RETURN DISTINCT
  creatorType.fqn AS creatorFqn,
  product.fqn AS productFqn,
  fm.name AS factoryMethodName,
  concreteCreatorFqns,
  concreteProductFqns
ORDER BY creatorFqn, productFqn, factoryMethodName;
