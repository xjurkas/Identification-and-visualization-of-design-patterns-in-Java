CALL {

// 1. Strategy: lokálny interface alebo abstraktná trieda
MATCH (strategy)
WHERE (strategy:Interface OR (strategy:Class AND strategy.isAbstract = true))
  AND EXISTS { MATCH (strategy)-[:IN_FILE]->() }

// 2. NOVÉ: ≥2 tranzitívne ConcreteStrategies
MATCH (strategyType:Type {fqn: strategy.fqn})
MATCH (cs)-[:IMPLEMENTS|EXTENDS*1..3]->(strategy)
WHERE cs:Class
WITH strategy, strategyType, count(DISTINCT cs) AS csCount
WHERE csCount >= 2

// 3. Context má field typu Strategy
MATCH (contextType:Type)-[:HAS_FIELD]->(field:Field)-[:FIELD_TYPE]->(strategyType)
WHERE contextType.fqn <> strategy.fqn

// 4. Anti-Decorator: Context NESMIE konformovať so Strategy
  AND NOT EXISTS {
    MATCH (ctxNode)-[:IMPLEMENTS|EXTENDS*1..4]->(strategy)
    WHERE ctxNode.fqn = contextType.fqn
  }

// 5. Delegácia: ≥1 CALLS
  AND EXISTS {
    MATCH (contextType)-[:DECLARES]->(ctxMethod:Method)-[:CALLS]->(stratMethod:Method)
    WHERE stratMethod.containerFqn = strategy.fqn
  }

WITH DISTINCT strategyType
SET strategyType:StrategyDP

RETURN DISTINCT strategyType
}

RETURN DISTINCT
  strategyType.fqn AS strategyFqn
ORDER BY strategyFqn;
