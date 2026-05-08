CALL {
// 1. Product: lokálny interface alebo abstraktná trieda
MATCH (product)
WHERE (product:Interface OR (product:Class AND product.isAbstract = true))
  AND EXISTS { MATCH (product)-[:IN_FILE]->() }

// 2. Creator deklaruje non-static metódu vracajúcu Product
MATCH (creatorType:Type)-[:DECLARES]->(fm:Method)
      -[:RETURN_TYPE]->(productType:Type {fqn: product.fqn})
WHERE creatorType.fqn <> product.fqn
  AND coalesce(fm.isStatic, false) = false
  AND coalesce(fm.isSynthetic, false) = false

// 3. ConcreteCreator rozširuje/implementuje Creator
MATCH (cc)-[:IMPLEMENTS|EXTENDS*1..3]->(creatorNode)
WHERE (cc:Class OR cc:Interface)
  AND creatorNode.fqn = creatorType.fqn
  AND cc.fqn <> creatorType.fqn

// 4. ConcreteCreator OVERRIDES factory metódu
MATCH (ccType:Type {fqn: cc.fqn})-[:DECLARES]->(ccMethod:Method)
      -[:OVERRIDES]->(fm)

// 5. Overriding metóda CREATES ConcreteProduct
MATCH (ccMethod)-[:CREATES]->(cpType:Type)

// 6. ConcreteProduct IMPLEMENTS/EXTENDS Product
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

SET creatorType:FactoryMethodCreator

RETURN DISTINCT
  creatorType,
  product,
  fm,
  concreteCreatorFqns,
  concreteProductFqns,
  concreteCreatorMethods
}

RETURN DISTINCT
  creatorType.fqn AS creatorFqn,
  product.fqn AS productFqn,
  fm.name AS factoryMethodName,
  product.fqn AS returnType,
  concreteCreatorFqns,
  concreteProductFqns,
  concreteCreatorMethods
ORDER BY creatorFqn, productFqn, factoryMethodName;
