"use client";

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const GRADES = ["中1", "中2", "中3", "高1", "高2", "高3", "OB/OG", "先生"];
const PRACTICE_TYPES = ["自練", "射込み", "立"];

const getPositionName = (index: number, total: number) => {
  if (total === 1) return "大前";
  if (index === 0) return "大前";
  if (index === total - 1) return "落";
  if (total === 3 && index === 1) return "中";
  if (index === total - 2) return "落前";
  return ["二的", "三的", "四的", "五的"][index - 1] || `${index + 1}番`;
};

export default function Home() {
  const [activeTab, setActiveTab] = useState<"individual" | "team" | "analysis" | "members" | "schedule" | "rankings">("individual");
  
  const [archers, setArchers] = useState<{ id: number; name: string; grade: string }[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // 👤 個人タブ
  const [indGrade, setIndGrade] = useState(GRADES[3]);
  const [indArcher, setIndArcher] = useState("");
  const [indPracticeType, setIndPracticeType] = useState(PRACTICE_TYPES[0]);
  const [indRecords, setIndRecords] = useState([{ id: 1, arrows: ["未", "未", "未", "未"] }]);

  // 👥 団体タブ
  const [frontSize, setFrontSize] = useState(3);
  const [backSize, setBackSize] = useState(0);
  const totalSize = frontSize + backSize;
  const [teamMembers, setTeamMembers] = useState<{ grade: string; name: string }[]>(Array.from({ length: 3 }, () => ({ grade: GRADES[3], name: "" })));
  const [teamRounds, setTeamRounds] = useState([{ id: 1, arrows: Array.from({ length: 3 }, () => ["未", "未", "未", "未"]) }]);

  // 📊 分析タブ
  const [anaGrade, setAnaGrade] = useState(GRADES[3]);
  const [anaArcher, setAnaArcher] = useState("");
  const [anaTimeframe, setAnaTimeframe] = useState<"all" | "year" | "month" | "week" | "custom_month">("all");
  const [anaCustomMonth, setAnaCustomMonth] = useState(new Date().toISOString().slice(0, 7));
  const [anaType, setAnaType] = useState<"all" | "tachi">("all");
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
  const [analysisData, setAnalysisData] = useState<{ hits: number; total: number; sessionsCount: number }>({ hits: 0, total: 0, sessionsCount: 0 });
  const [arrowStats, setArrowStats] = useState<{ hits: number; total: number }[]>([{ hits: 0, total: 0 }, { hits: 0, total: 0 }, { hits: 0, total: 0 }, { hits: 0, total: 0 }]);
  const [chartData, setChartData] = useState<{ date: string; "的中率(%)": number }[]>([]);
  const [tachiStats, setTachiStats] = useState({ kaichu: 0, sanchu: 0, nichu: 0, itchu: 0, zannen: 0 });

  // 🏆 ランキング用ステート
  const [rankings, setRankings] = useState<{
    hitRate: any[],
    totalArrows: any[],
    totalHits: any[],
    tachiRate: any[]
  }>({ hitRate: [], totalArrows: [], totalHits: [], tachiRate: [] });

  // 📖 名簿タブ
  const [newArcherName, setNewArcherName] = useState("");
  const [newArcherGrade, setNewArcherGrade] = useState(GRADES[3]);

  useEffect(() => { fetchArchers(); }, []);
  useEffect(() => { 
    if (activeTab === "analysis" && anaArcher) fetchAnalysisData();
    if (activeTab === "rankings") fetchRankingData(); 
  }, [activeTab, anaArcher, anaTimeframe, anaCustomMonth, anaType]);

  const fetchArchers = async () => {
    const { data } = await supabase.from("archers").select("*").order("name", { ascending: true });
    if (data) setArchers(data);
  };

  const handleAddArcher = async () => {
    if (!newArcherName.trim()) return;
    const { error } = await supabase.from("archers").insert([{ name: newArcherName, grade: newArcherGrade }]);
    if (!error) { await fetchArchers(); alert(`${newArcherName}さんを登録しました！🎉`); setNewArcherName(""); }
  };

  const toggleIndArrow = (rIndex: number, aIndex: number) => {
    const newRecords = [...indRecords];
    const s = newRecords[rIndex].arrows[aIndex];
    newRecords[rIndex].arrows[aIndex] = s === "未" ? "○" : s === "○" ? "×" : "未";
    setIndRecords(newRecords);
  };

  const toggleTeamArrow = (rIndex: number, mIndex: number, aIndex: number) => {
    const newRounds = [...teamRounds];
    const current = newRounds[rIndex].arrows[mIndex][aIndex];
    newRounds[rIndex].arrows[mIndex] = [...newRounds[rIndex].arrows[mIndex]];
    newRounds[rIndex].arrows[mIndex][aIndex] = current === "未" ? "○" : current === "○" ? "×" : "未";
    setTeamRounds(newRounds);
  };

  const updateTeamSizes = (newFront: number, newBack: number) => {
    setFrontSize(newFront); setBackSize(newBack);
    const newTotal = newFront + newBack;
    setTeamMembers(prev => {
      const newM = [...prev];
      while (newM.length < newTotal) newM.push({ grade: GRADES[3], name: "" });
      if (newM.length > newTotal) newM.length = newTotal;
      return newM;
    });
    setTeamRounds(prev => prev.map(r => {
      const newArr = [...r.arrows];
      while (newArr.length < newTotal) newArr.push(["未", "未", "未", "未"]);
      if (newArr.length > newTotal) newArr.length = newTotal;
      return { ...r, arrows: newArr };
    }));
  };

  const saveIndividual = async () => {
    if (!indArcher) { alert("名前を選択してください！"); return; }
    setIsSaving(true);
    try {
      const { error } = await supabase.from("practice_sessions").insert([{ archer_name: indArcher, records: indRecords, practice_type: indPracticeType }]);
      if (error) throw error;
      alert(`🎉 ${indArcher}さんの記録を保存しました！`);
      setIndRecords([{ id: 1, arrows: ["未", "未", "未", "未"] }]);
    } catch (err: any) { alert("保存エラー: " + err.message); } finally { setIsSaving(false); }
  };

  const saveTeam = async () => {
    if (totalSize === 0) return;
    if (teamMembers.some(m => !m.name)) { alert("全員の名前を選択してください！"); return; }
    setIsSaving(true);
    try {
      const inserts = teamMembers.map((m, mIndex) => {
        const personRecords = teamRounds.map(r => ({ id: r.id, arrows: r.arrows[mIndex] }));
        return { archer_name: m.name, records: personRecords, practice_type: "立" };
      });
      const { error } = await supabase.from("practice_sessions").insert(inserts);
      if (error) throw error;
      alert(`🎉 団体の記録を保存しました！`);
      setTeamRounds([{ id: 1, arrows: Array.from({ length: totalSize }, () => ["未", "未", "未", "未"]) }]);
    } catch (err: any) { alert("保存エラー: " + err.message); } finally { setIsSaving(false); }
  };

  const fetchAnalysisData = async () => {
    if (!anaArcher) return;
    setIsLoadingAnalysis(true);
    try {
      const { data, error } = await supabase.from("practice_sessions").select("*").eq("archer_name", anaArcher);
      if (error) throw error;
      let hits = 0; let total = 0;
      let newArrowStats = [{ hits: 0, total: 0 }, { hits: 0, total: 0 }, { hits: 0, total: 0 }, { hits: 0, total: 0 }];
      let chartGroups: { [key: string]: { display: string; hits: number; total: number } } = {};
      let kaichu = 0, sanchu = 0, nichu = 0, itchu = 0, zannen = 0;
      const now = new Date();

      const filteredData = (data || []).filter(session => {
        const d = new Date(session.created_at);
        if (anaType === "tachi" && session.practice_type !== "立") return false;
        if (anaTimeframe === "year") return d.getFullYear() === now.getFullYear();
        if (anaTimeframe === "month") return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
        if (anaTimeframe === "week") return d >= new Date(now.setDate(now.getDate() - 7));
        if (anaTimeframe === "custom_month") {
          const [year, month] = anaCustomMonth.split("-");
          return d.getFullYear() === parseInt(year) && d.getMonth() === parseInt(month) - 1;
        }
        return true;
      });

      filteredData.forEach(session => {
        const d = new Date(session.created_at);
        const sortKey = anaTimeframe === "all" ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const displayKey = anaTimeframe === "all" ? `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}` : `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
        if (!chartGroups[sortKey]) chartGroups[sortKey] = { display: displayKey, hits: 0, total: 0 };

        session.records.forEach((record: any) => {
          let roundHits = 0; let isValidRound = 0;
          record.arrows.forEach((arrow: string, i: number) => {
            if (arrow === "○" || arrow === "×") isValidRound++;
            if (arrow === "○") { hits++; total++; roundHits++; if (i < 4) { newArrowStats[i].hits++; newArrowStats[i].total++; } chartGroups[sortKey].hits++; chartGroups[sortKey].total++; } 
            else if (arrow === "×") { total++; if (i < 4) { newArrowStats[i].total++; } chartGroups[sortKey].total++; }
          });
          if (isValidRound === 4) {
            if (roundHits === 4) kaichu++; else if (roundHits === 3) sanchu++; else if (roundHits === 2) nichu++; else if (roundHits === 1) itchu++; else if (roundHits === 0) zannen++;
          }
        });
      });
      const newChartData = Object.keys(chartGroups).sort().map(key => ({ date: chartGroups[key].display, "的中率(%)": chartGroups[key].total > 0 ? Math.round((chartGroups[key].hits / chartGroups[key].total) * 100) : 0 }));
      setAnalysisData({ hits, total, sessionsCount: filteredData.length }); setArrowStats(newArrowStats); setChartData(newChartData); setTachiStats({ kaichu, sanchu, nichu, itchu, zannen });
    } catch (error) { console.error(error); } finally { setIsLoadingAnalysis(false); }
  };

  // 🏆 ランキングデータの計算 (🔥バグ修正版！)
  const fetchRankingData = async () => {
    const { data, error } = await supabase.from("practice_sessions").select("*");
    if (error || !data) return;

    const stats: { [name: string]: { name: string, hits: number, total: number, tachiHits: number, tachiTotal: number } } = {};
    
    data.forEach(s => {
      if (!stats[s.archer_name]) stats[s.archer_name] = { name: s.archer_name, hits: 0, total: 0, tachiHits: 0, tachiTotal: 0 };
      s.records.forEach((r: any) => {
        r.arrows.forEach((a: string) => {
          // ▼ 修正ポイント: ○でも×でも「合計矢数」には必ず1を足す！
          if (a === "○" || a === "×") {
            stats[s.archer_name].total++;
            if (s.practice_type === "立") stats[s.archer_name].tachiTotal++;
            
            // 当たりの時だけ「的中数」に足す
            if (a === "○") {
              stats[s.archer_name].hits++;
              if (s.practice_type === "立") stats[s.archer_name].tachiHits++;
            }
          }
        });
      });
    });

    const members = Object.values(stats);
    if (members.length === 0) return;

    // 幽霊部員を除外
    const activeMembers = members.filter(m => m.total > 0);
    if (activeMembers.length === 0) {
      setRankings({ hitRate: [], totalArrows: [], totalHits: [], tachiRate: [] });
      return;
    }

    const avgArrows = activeMembers.reduce((sum, m) => sum + m.total, 0) / activeMembers.length;
    const threshold = avgArrows / 2;

    const hitRate = members
      .filter(m => m.total >= threshold)
      .map(m => ({ ...m, value: Math.round((m.hits / m.total) * 100) }))
      .sort((a, b) => b.value - a.value).slice(0, 5);

    const totalArrows = members
      .map(m => ({ ...m, value: m.total }))
      .sort((a, b) => b.value - a.value).slice(0, 5);

    const totalHits = members
      .map(m => ({ ...m, value: m.hits }))
      .sort((a, b) => b.value - a.value).slice(0, 5);

    // 修正されたデータで立的中率を計算！
    const tachiRate = members
      .filter(m => m.total >= threshold && m.tachiTotal > 0)
      .map(m => ({ ...m, value: Math.round((m.tachiHits / m.tachiTotal) * 100) }))
      .sort((a, b) => b.value - a.value).slice(0, 5);

    setRankings({ hitRate, totalArrows, totalHits, tachiRate });
  };

  return (
    <main className="p-4 sm:p-8 max-w-2xl mx-auto min-h-screen bg-gray-50 text-black font-sans pb-20">
      <h1 className="text-3xl font-bold text-center mb-6">🎯 弓道Webアプリ</h1>

      <div className="flex bg-gray-200 p-1 rounded-2xl mb-8 shadow-inner overflow-x-auto">
        {[
          {id: "individual", label: "個人"}, {id: "team", label: "団体"}, {id: "analysis", label: "分析"},
          {id: "rankings", label: "🏆"}, {id: "members", label: "名簿"}, {id: "schedule", label: "予定"}
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex-1 min-w-[50px] py-2.5 text-[10px] sm:text-xs font-bold rounded-xl transition-all px-1 ${activeTab === tab.id ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:bg-gray-300"}`}>{tab.label}</button>
        ))}
      </div>

      {activeTab === "individual" && (
        <div className="animate-fade-in">
          <div className="mb-6 p-5 bg-white rounded-2xl border border-gray-200 shadow-sm space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-gray-400 mb-1">練習種別</label>
              <div className="flex gap-2">
                {PRACTICE_TYPES.map(type => (
                  <button key={type} onClick={() => setIndPracticeType(type)} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all border-2 ${indPracticeType === type ? "bg-blue-50 border-blue-500 text-blue-600" : "bg-white border-gray-100 text-gray-400"}`}>{type}</button>
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-1/3">
                <label className="block text-[10px] font-bold text-gray-400 mb-1">GRADE</label>
                <select value={indGrade} onChange={(e) => { setIndGrade(e.target.value); setIndArcher(""); }} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold text-blue-600 outline-none">
                  {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-[10px] font-bold text-gray-400 mb-1">ARCHER</label>
                <select value={indArcher} onChange={(e) => setIndArcher(e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-base outline-none">
                  <option value="">名前を選択...</option>
                  {archers.filter(a => a.grade === indGrade).map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div className="space-y-6 mb-8">
            {indRecords.map((record, rIndex) => (
              <div key={record.id} className="bg-white p-6 rounded-3xl shadow-sm border border-gray-200 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-2 h-full bg-blue-500"></div>
                <p className="text-center text-gray-400 text-xs font-black mb-4">{rIndex + 1}立目</p>
                <div className="flex justify-center gap-4">
                  {record.arrows.map((state, aIndex) => (
                    <button key={aIndex} onClick={() => toggleIndArrow(rIndex, aIndex)} className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full text-3xl font-bold transition-all border-4 ${state === "○" ? "bg-red-500 text-white border-red-200" : state === "×" ? "bg-blue-500 text-white border-blue-200" : "bg-gray-100 text-gray-300 border-gray-200"}`}>{state}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <button onClick={() => indRecords.length > 1 && setIndRecords(indRecords.slice(0, -1))} className="py-4 bg-white border border-gray-200 text-gray-500 font-bold rounded-2xl">➖ 減らす</button>
            <button onClick={() => setIndRecords([...indRecords, { id: indRecords.length + 1, arrows: ["未", "未", "未", "未"] }])} className="py-4 bg-gray-800 text-white font-bold rounded-2xl">➕ 立を追加</button>
          </div>
          <button onClick={saveIndividual} disabled={isSaving} className="w-full py-5 bg-green-500 text-white text-xl font-bold rounded-2xl shadow-lg active:scale-95 disabled:opacity-50">
            {isSaving ? "送信中..." : "💾 保存してリセット"}
          </button>
        </div>
      )}

      {activeTab === "team" && (
        <div className="animate-fade-in">
          <div className="mb-6 p-5 bg-white rounded-2xl border border-gray-200 shadow-sm">
            <h2 className="font-bold text-gray-700 mb-4 text-sm">👥 立の編成 (計{totalSize}人)</h2>
            <div className="flex gap-4 mb-6 bg-gray-50 p-3 rounded-xl">
              <div className="flex-1">
                <label className="block text-[10px] font-bold text-gray-400 mb-1">前射場</label>
                <select value={frontSize} onChange={(e) => updateTeamSizes(parseInt(e.target.value), backSize)} className="w-full p-2 border border-gray-200 rounded-lg font-bold text-blue-600 outline-none">
                  {[0, 1, 2, 3, 4, 5].map(num => <option key={num} value={num}>{num}人</option>)}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-[10px] font-bold text-gray-400 mb-1">後ろ射場</label>
                <select value={backSize} onChange={(e) => updateTeamSizes(frontSize, parseInt(e.target.value))} className="w-full p-2 border border-gray-200 rounded-lg font-bold text-blue-600 outline-none">
                  {[0, 1, 2, 3, 4, 5].map(num => <option key={num} value={num}>{num}人</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              {teamMembers.map((member, index) => {
                const isFirst = index === 0 || index === frontSize;
                const localIndex = index < frontSize ? index : index - frontSize;
                const localTotal = index < frontSize ? frontSize : backSize;
                return (
                  <div key={index}>
                    {isFirst && <p className="text-[10px] font-bold text-blue-500 mt-3 mb-1">{index < frontSize ? "🎯 前射場" : "🎯 後ろ射場"}</p>}
                    <div className="flex gap-2 items-center bg-gray-50 p-2 rounded-xl">
                      <div className="w-10 text-[10px] font-black text-white bg-gray-800 py-1 rounded text-center">{getPositionName(localIndex, localTotal)}</div>
                      <select value={member.grade} onChange={(e) => { const newM = [...teamMembers]; newM[index] = { grade: e.target.value, name: "" }; setTeamMembers(newM); }} className="w-16 p-1.5 bg-white border border-gray-200 rounded text-[10px]">
                        {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                      <select value={member.name} onChange={(e) => { const newM = [...teamMembers]; newM[index].name = e.target.value; setTeamMembers(newM); }} className="flex-1 p-1.5 bg-white border border-gray-200 rounded text-xs">
                        <option value="">選択...</option>
                        {archers.filter(a => a.grade === member.grade).map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          {totalSize > 0 && (
            <div className="space-y-6 mb-8">
              {teamRounds.map((round, rIndex) => (
                <div key={round.id} className="bg-white p-4 rounded-3xl shadow-sm border border-gray-200 relative overflow-hidden">
                  <p className="text-center text-gray-400 text-[10px] font-black mb-3">{rIndex + 1}立目</p>
                  <div className="space-y-2">
                    {round.arrows.map((personArrows, mIndex) => (
                      <div key={mIndex} className="flex items-center gap-2 border-b border-gray-50 pb-2 last:border-0">
                        <div className="w-12"><span className="font-bold text-gray-700 text-[10px] truncate block">{teamMembers[mIndex]?.name || "未選択"}</span></div>
                        <div className="flex gap-1.5 flex-1 justify-end">
                          {personArrows.map((state, aIndex) => (
                            <button key={aIndex} onClick={() => toggleTeamArrow(rIndex, mIndex, aIndex)} className={`w-10 h-10 rounded-full text-lg font-bold transition-all border-2 ${state === "○" ? "bg-red-500 text-white border-red-100" : state === "×" ? "bg-blue-500 text-white border-blue-100" : "bg-gray-100 text-gray-300 border-gray-100"}`}>{state}</button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <button onClick={() => teamRounds.length > 1 && setTeamRounds(teamRounds.slice(0, -1))} className="py-4 bg-white border border-gray-200 text-gray-500 font-bold rounded-2xl">➖ 減らす</button>
            <button onClick={() => setTeamRounds([...teamRounds, { id: teamRounds.length + 1, arrows: Array.from({ length: totalSize }, () => ["未", "未", "未", "未"]) }])} className="py-4 bg-gray-800 text-white font-bold rounded-2xl">➕ 立を追加</button>
          </div>
          <button onClick={saveTeam} disabled={isSaving || totalSize === 0} className="w-full py-5 bg-green-500 text-white text-xl font-bold rounded-2xl shadow-lg active:scale-95 disabled:opacity-50">💾 全員の記録を保存</button>
        </div>
      )}

      {/* 📊 分析タブ */}
      {activeTab === "analysis" && (
        <div className="animate-fade-in space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex gap-3">
            <div className="w-1/3">
              <label className="block text-[10px] font-bold text-gray-400 mb-1">GRADE</label>
              <select value={anaGrade} onChange={(e) => { setAnaGrade(e.target.value); setAnaArcher(""); }} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold text-blue-600 outline-none">
                {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-[10px] font-bold text-gray-400 mb-1">ARCHER</label>
              <select value={anaArcher} onChange={(e) => setAnaArcher(e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-base outline-none">
                <option value="">名前を選択...</option>
                {archers.filter(a => a.grade === anaGrade).map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
              </select>
            </div>
          </div>
          {anaArcher && (
            <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
              <div className="bg-gray-800 p-4 text-white">
                <h2 className="text-lg font-bold mb-4">📊 {anaArcher} さん</h2>
                <div className="flex flex-wrap bg-gray-700 rounded-lg p-1 gap-1">
                  {["all", "year", "month", "week", "custom_month"].map(t => (
                    <button key={t} onClick={() => setAnaTimeframe(t as any)} className={`flex-1 min-w-[50px] text-[10px] py-2 rounded-md font-bold transition-all ${anaTimeframe === t ? "bg-blue-500 shadow" : "text-gray-400"}`}>{t === "all" ? "全" : t === "year" ? "年" : t === "month" ? "月" : t === "week" ? "週" : "指定"}</button>
                  ))}
                </div>
              </div>
              <div className="p-5 space-y-8">
                <div className="text-center">
                  <p className="text-[60px] font-black text-blue-600 leading-none">{((analysisData.hits / analysisData.total) * 100).toFixed(1)}<span className="text-xl ml-1">%</span></p>
                  <p className="text-gray-400 font-bold mt-2">{analysisData.hits} 中 / {analysisData.total} 射</p>
                </div>
                <div className="grid grid-cols-5 gap-1">
                  {[
                    {l: "皆中", v: tachiStats.kaichu, c: "bg-red-50 text-red-600"}, {l: "三中", v: tachiStats.sanchu, c: "bg-orange-50 text-orange-600"},
                    {l: "二中", v: tachiStats.nichu, c: "bg-green-50 text-green-600"}, {l: "一中", v: tachiStats.itchu, c: "bg-blue-50 text-blue-600"},
                    {l: "残念", v: tachiStats.zannen, c: "bg-gray-50 text-gray-600"}
                  ].map(s => <div key={s.l} className={`${s.c} py-2 rounded-xl text-center border border-current opacity-20 border-opacity-10`} style={{borderColor: "rgba(0,0,0,0.1)"}}><p className="text-[10px] font-bold">{s.l}</p><p className="text-sm font-black">{s.v}回</p></div>)}
                </div>
                {chartData.length > 0 && (
                  <div className="h-40 w-full"><ResponsiveContainer><LineChart data={chartData}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="date" hide /><YAxis domain={[0, 100]} hide /><Tooltip /><Line type="monotone" dataKey="的中率(%)" stroke="#3b82f6" strokeWidth={3} dot={false} /></LineChart></ResponsiveContainer></div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 🏆 ランキングタブ */}
      {activeTab === "rankings" && (
        <div className="animate-fade-in space-y-6">
          <p className="text-[10px] text-gray-400 text-center font-bold">※的中率は「本当に練習している人の平均矢数」の半分以上を引いている人のみ表示</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              {title: "🎯 的中率 (TOP5)", data: rankings.hitRate, unit: "%", color: "text-red-500"},
              {title: "🔥 矢数 (TOP5)", data: rankings.totalArrows, unit: "射", color: "text-blue-500"},
              {title: "🌟 的中数 (TOP5)", data: rankings.totalHits, unit: "中", color: "text-green-500"},
              {title: "🥋 立的中率 (TOP5)", data: rankings.tachiRate, unit: "%", color: "text-purple-500"}
            ].map(r => (
              <div key={r.title} className="bg-white p-5 rounded-3xl border border-gray-200 shadow-sm">
                <h3 className="text-xs font-black text-gray-400 mb-4 border-b pb-2">{r.title}</h3>
                <div className="space-y-3">
                  {r.data.length > 0 ? r.data.map((m, i) => (
                    <div key={m.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className={`w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-black ${i === 0 ? "bg-yellow-400 text-white" : "bg-gray-100 text-gray-400"}`}>{i+1}</span>
                        <span className="text-sm font-bold text-gray-700">{m.name}</span>
                      </div>
                      <span className={`text-sm font-black ${r.color}`}>{m.value}{r.unit}</span>
                    </div>
                  )) : <p className="text-[10px] text-gray-300 py-4 text-center">データがありません</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 📖 名簿タブ */}
      {activeTab === "members" && (
        <div className="animate-fade-in space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-gray-200">
            <h2 className="text-xl font-bold mb-4 text-gray-800">👤 メンバー登録</h2>
            <div className="space-y-4">
              <select value={newArcherGrade} onChange={(e) => setNewArcherGrade(e.target.value)} className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl font-bold text-blue-600 outline-none">
                {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
              <input type="text" placeholder="名前" value={newArcherName} onChange={(e) => setNewArcherName(e.target.value)} className="w-full p-4 border border-gray-200 bg-gray-50 rounded-xl outline-none" />
              <button onClick={handleAddArcher} className="w-full py-4 bg-blue-500 text-white font-bold rounded-xl active:scale-95">名簿に登録</button>
            </div>
          </div>
        </div>
      )}

      {/* 📅 予定表タブ */}
      {activeTab === "schedule" && (
        <div className="animate-fade-in space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-gray-200">
            <h2 className="text-xl font-bold mb-4 text-gray-800">📅 今月の予定</h2>
            <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm">
              <img src="/schedule.jpg" alt="予定表" className="w-full h-auto" />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}