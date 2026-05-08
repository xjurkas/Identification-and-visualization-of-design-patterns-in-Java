CALL {

// 1. Strategy: lokálny interface alebo abstraktná trieda
MATCH (strategy)
WHERE (strategy:Interface OR (strategy:Class AND strategy.isAbstract = true))
  AND EXISTS { MATCH (strategy)-[:IN_FILE]->() }

// 2. ≥2 tranzitívne ConcreteStrategies
MATCH (strategyType:Type {fqn: strategy.fqn})
MATCH (cs)-[:IMPLEMENTS|EXTENDS*1..3]->(strategy)
WHERE cs:Class
WITH
  strategy,
  strategyType,
  collect(DISTINCT cs.fqn) AS concreteStrategyFqns,
  count(DISTINCT cs) AS csCount
WHERE csCount >= 2

// 3. Context má field typu Strategy
MATCH (contextType:Type)-[:HAS_FIELD]->(field:Field)-[:FIELD_TYPE]->(strategyType)
WHERE contextType.fqn <> strategy.fqn

// 4. Anti-Decorator
  AND NOT EXISTS {
    MATCH (ctxNode)-[:IMPLEMENTS|EXTENDS*1..4]->(strategy)
    WHERE ctxNode.fqn = contextType.fqn
  }

// 5. NOVÉ: Field nesmie byť statický
  AND coalesce(field.isStatic, false) = false
  AND NOT EXISTS {
    MATCH (field)-[:HAS_MODIFIER]->(:Modifier {name:"static"})
  }

// 6. Delegácia
  AND EXISTS {
    MATCH (contextType)-[:DECLARES]->(ctxMethod:Method)-[:CALLS]->(stratMethod:Method)
    WHERE stratMethod.containerFqn = strategy.fqn
  }

WITH DISTINCT strategyType, contextType, concreteStrategyFqns
SET strategyType:StrategyDP

RETURN DISTINCT strategyType, contextType, concreteStrategyFqns
}

RETURN DISTINCT
  contextType.fqn AS contextFqn,
  strategyType.fqn AS strategyFqn,
  concreteStrategyFqns
ORDER BY contextFqn, strategyFqn;
