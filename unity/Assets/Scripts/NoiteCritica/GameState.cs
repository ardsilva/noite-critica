// Estado do jogo: espelho de `S` em src/main.js. Sem MonoBehaviour para ser testavel em EditMode.
using System.Collections.Generic;
using Newtonsoft.Json.Linq;

namespace NoiteCritica
{
    public class GameState
    {
        public string Room;
        public string Active;
        public readonly HashSet<string> Flags = new HashSet<string>();
        public readonly List<string> Inventory = new List<string>();
        public readonly Dictionary<string, int> Hp = new Dictionary<string, int>();
        public readonly Dictionary<string, int> HpMax = new Dictionary<string, int>();
        public readonly HashSet<string> Looked = new HashSet<string>();
        public bool Busy, InCutscene, Skipping;

        public void Init(JObject content)
        {
            Active = (string)content["start"]["active"];
            foreach (var k in (JArray)content["party"])
            {
                Hp[(string)k["id"]] = (int)k["hp"];
                HpMax[(string)k["id"]] = (int)k["hp"];
            }
            foreach (var i in (JArray)content["start"]["items"]) Inventory.Add((string)i);
        }

        /// Condicoes: "flag", "!flag", "has:item", "low" (ativo com 1 PV). "$a" = crianca ativa.
        public bool Test(JToken conds)
        {
            if (conds == null) return true;
            foreach (var c0 in conds)
            {
                var c = ((string)c0).Replace("$a", Active);
                bool neg = c.StartsWith("!");
                var f = neg ? c.Substring(1) : c;
                bool v = f.StartsWith("has:") ? Inventory.Contains(f.Substring(4))
                       : f == "low" ? Hp[Active] <= 1
                       : Flags.Contains(f);
                if (neg == v) return false;
            }
            return true;
        }

        /// Primeira regra que casa verbo, crianca ativa, item e condicoes (a ordem no JSON importa).
        public JObject FindRule(JToken rules, string verb, string item)
        {
            if (rules == null) return null;
            foreach (JObject r in rules)
            {
                if ((string)r["v"] != verb) continue;
                if (r["who"] != null && (string)r["who"] != Active) continue;
                if (verb == "item" && (string)r["item"] != item) continue;
                if (!Test(r["if"])) continue;
                return r;
            }
            return null;
        }

        public void ChangeHp(string who, int delta)
        {
            Hp[who] = System.Math.Max(1, System.Math.Min(HpMax[who], Hp[who] + delta));
            if (delta < 0) Flags.Add("hurt_" + who); else Flags.Remove("hurt_" + who);
        }
    }
}
