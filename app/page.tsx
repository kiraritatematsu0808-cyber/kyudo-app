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
  // 📱 タブに「schedule（予定表）」を追加して5項目に！
  const [activeTab, setActiveTab] = useState<"individual" | "team" | "analysis" | "members" | "schedule">("individual");
  
  const [archers, setArchers] = useState<{ id: number; name: string; grade: string }[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // 👤 個人タブ用
  const [indGrade, setIndGrade] = useState(GRADES[3]);
  const [indArcher, setIndArcher] = useState("");
  const [indPracticeType, setIndPracticeType] = useState(PRACTICE_TYPES[0]);
  const [indRecords, setIndRecords] = useState([{ id: 1, arrows: ["未", "未", "未", "未"] }]);

  // 👥 団体タブ用
  const [frontSize, setFrontSize] = useState(3);
  const [backSize, setBackSize] = useState(0);
  const totalSize = frontSize + backSize;

  const [teamMembers, setTeamMembers] = useState<{ grade: string; name: string }[]>(
    Array.from({ length: 3 }, () => ({ grade: GRADES[3], name: "" }))
  );
  const [teamRounds, setTeamRounds] = useState([
    { id: 1, arrows: Array.from({ length: 3 }, () => ["未", "未", "未", "未"]) }
  ]);

  // 📊 分析タブ用
  const [anaGrade, setAnaGrade] = useState(GRADES[3]);
  const [anaArcher, setAnaArcher] = useState("");
  // ⏳ 「year（年間）」を追加！
  const [anaTimeframe, setAnaTimeframe] = useState<"all" | "year" | "month" | "week" | "custom_month">("all");
  const [anaCustomMonth, setAnaCustomMonth] = useState(new Date().toISOString().slice(0, 7));
  const [anaType, setAnaType] = useState<"all" | "tachi">("all");
  
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
  const [analysisData, setAnalysisData] = useState<{ hits: number; total: number; sessionsCount: number }>({ hits: 0, total: 0, sessionsCount: 0 });
  const [arrowStats, setArrowStats] = useState<{ hits: number; total: number }[]>([{ hits: 0, total: 0 }, { hits: 0, total: 0 }, { hits: 0, total: 0 }, { hits: 0, total: 0 }]);
  const [chartData, setChartData] = useState<{ date: string; "的中率(%)": number }[]>([]);
  
  // 🎯 皆中〜残念のカウント用ステート
  const [tachiStats, setTachiStats] = useState({ kaichu: 0, sanchu: 0, nichu: 0, itchu: 0, zannen: 0 });

  // 📖 名簿タブ用
  const [newArcherName, setNewArcherName] = useState("");
  const [newArcherGrade, setNewArcherGrade] = useState(GRADES[3]);

  useEffect(() => { fetchArchers(); }, []);
  useEffect(() => { if (activeTab === "analysis" && anaArcher) fetchAnalysisData(); }, [activeTab, anaArcher, anaTimeframe, anaCustomMonth, anaType]);

  const fetchArchers = async () => {
    const { data } = await supabase.from("archers").select("*").order("name", { ascending: true });
    if (data) setArchers(data);
  };

  const handleAddArcher = async () => {
    if (!newArcherName.trim()) return;
    const { error } = await supabase.from("archers").insert([{ name: newArcherName, grade: newArcherGrade }]);
    if (!error) {
      await fetchArchers();
      alert(`${newArcherName}さんを登録しました！🎉`);
      setNewArcherName("");
    }
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
    setFrontSize(newFront);
    setBackSize(newBack);
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
      alert(`🎉 ${indArcher}さんの記録（${indPracticeType}）を保存しました！`);
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
      alert(`🎉 団体（計${totalSize}人）の記録を保存しました！`);
      setTeamRounds([{ id: 1, arrows: Array.from({ length: totalSize }, () => ["未", "未", "未", "未"]) }]);
    } catch (err: any) { alert("保存エラー: " + err.message); } finally { setIsSaving(false); }
  };

  // 📊 分析データの取得と計算
  const fetchAnalysisData = async () => {
    if (!anaArcher) return;
    setIsLoadingAnalysis(true);
    try {
      const { data, error } = await supabase.from("practice_sessions").select("*").eq("archer_name", anaArcher);
      if (error) throw error;

      let hits = 0; let total = 0;
      let newArrowStats = [ { hits: 0, total: 0 }, { hits: 0, total: 0 }, { hits: 0, total: 0 }, { hits: 0, total: 0 } ];
      let chartGroups: { [key: string]: { display: string; hits: number; total: number } } = {};
      
      // 皆中〜残念のカウンター
      let kaichu = 0, sanchu = 0, nichu = 0, itchu = 0, zannen = 0;
      
      const now = new Date();

      const filteredData = (data || []).filter(session => {
        const sessionDate = new Date(session.created_at);
        if (anaType === "tachi" && session.practice_type !== "立") return false;
        
        // 期間フィルター（「年間」を追加）
        if (anaTimeframe === "year") return sessionDate.getFullYear() === now.getFullYear();
        if (anaTimeframe === "month") return sessionDate.getFullYear() === now.getFullYear() && sessionDate.getMonth() === now.getMonth();
        if (anaTimeframe === "week") return sessionDate >= new Date(now.setDate(now.getDate() - 7));
        if (anaTimeframe === "custom_month") {
          const [year, month] = anaCustomMonth.split("-");
          return sessionDate.getFullYear() === parseInt(year) && sessionDate.getMonth() === parseInt(month) - 1;
        }
        return true;
      });

      filteredData.forEach(session => {
        const d = new Date(session.created_at);
        const sortKey = anaTimeframe === "all" ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const displayKey = anaTimeframe === "all" ? `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}` : `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;

        if (!chartGroups[sortKey]) chartGroups[sortKey] = { display: displayKey, hits: 0, total: 0 };

        session.records.forEach((record: any) => {
          let roundHits = 0; // 1立（4本）の中での的中数
          let isValidRound = 0; // ちゃんと4本引いたかチェック用
          
          record.arrows.forEach((arrow: string, i: number) => {
            if (arrow === "○" || arrow === "×") isValidRound++;
            
            if (arrow === "○") { 
              hits++; total++; roundHits++;
              if (i < 4) { newArrowStats[i].hits++; newArrowStats[i].total++; } 
              chartGroups[sortKey].hits++; chartGroups[sortKey].total++; 
            } 
            else if (arrow === "×") { 
              total++; 
              if (i < 4) { newArrowStats[i].total++; } 
              chartGroups[sortKey].total++; 
            }
          });

          // 4本引き終わっている立のみ、皆中や残念としてカウントする
          if (isValidRound === 4) {
            if (roundHits === 4) kaichu++;
            else if (roundHits === 3) sanchu++;
            else if (roundHits === 2) nichu++;
            else if (roundHits === 1) itchu++;
            else if (roundHits === 0) zannen++;
          }
        });
      });

      const newChartData = Object.keys(chartGroups).sort().map(key => ({ date: chartGroups[key].display, "的中率(%)": chartGroups[key].total > 0 ? Math.round((chartGroups[key].hits / chartGroups[key].total) * 100) : 0 }));
      
      setAnalysisData({ hits, total, sessionsCount: filteredData.length });
      setArrowStats(newArrowStats);
      setChartData(newChartData);
      setTachiStats({ kaichu, sanchu, nichu, itchu, zannen }); // ステートを更新
      
    } catch (error) { console.error("分析エラー:", error); } finally { setIsLoadingAnalysis(false); }
  };

  return (
    <main className="p-4 sm:p-8 max-w-2xl mx-auto min-h-screen bg-gray-50 text-black font-sans">
      <h1 className="text-3xl font-bold text-center mb-6">🎯 弓道Webアプリ</h1>

      {/* 🟢 5項目になったタブメニュー！ */}
      <div className="flex bg-gray-200 p-1.5 rounded-2xl mb-8 shadow-inner overflow-x-auto snap-x">
        <button onClick={() => setActiveTab("individual")} className={`flex-1 min-w-[65px] py-3 text-[11px] sm:text-sm font-bold rounded-xl transition-all whitespace-nowrap px-1 ${activeTab === "individual" ? "bg-white text-blue-600 shadow-md" : "text-gray-500 hover:bg-gray-300"}`}>👤 個人</button>
        <button onClick={() => setActiveTab("team")} className={`flex-1 min-w-[65px] py-3 text-[11px] sm:text-sm font-bold rounded-xl transition-all whitespace-nowrap px-1 ${activeTab === "team" ? "bg-white text-blue-600 shadow-md" : "text-gray-500 hover:bg-gray-300"}`}>👥 団体</button>
        <button onClick={() => setActiveTab("analysis")} className={`flex-1 min-w-[65px] py-3 text-[11px] sm:text-sm font-bold rounded-xl transition-all whitespace-nowrap px-1 ${activeTab === "analysis" ? "bg-white text-blue-600 shadow-md" : "text-gray-500 hover:bg-gray-300"}`}>📊 分析</button>
        <button onClick={() => setActiveTab("members")} className={`flex-1 min-w-[65px] py-3 text-[11px] sm:text-sm font-bold rounded-xl transition-all whitespace-nowrap px-1 ${activeTab === "members" ? "bg-white text-blue-600 shadow-md" : "text-gray-500 hover:bg-gray-300"}`}>📖 名簿</button>
        <button onClick={() => setActiveTab("schedule")} className={`flex-1 min-w-[65px] py-3 text-[11px] sm:text-sm font-bold rounded-xl transition-all whitespace-nowrap px-1 ${activeTab === "schedule" ? "bg-white text-blue-600 shadow-md" : "text-gray-500 hover:bg-gray-300"}`}>📅 予定</button>
      </div>

      {/* ==========================================
          👤 個人タブ・👥 団体タブ (既存機能そのまま)
      ========================================== */}
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
                    <button key={aIndex} onClick={() => toggleIndArrow(rIndex, aIndex)} className={`w-16 h-16 rounded-full text-3xl font-bold transition-all active:scale-90 border-4 ${state === "○" ? "bg-red-500 text-white border-red-200" : state === "×" ? "bg-blue-500 text-white border-blue-200" : "bg-gray-100 text-gray-300 border-gray-200"}`}>{state}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <button onClick={() => indRecords.length > 1 && setIndRecords(indRecords.slice(0, -1))} className="py-4 bg-white border border-gray-200 text-gray-500 font-bold rounded-2xl shadow-sm">➖ 減らす</button>
            <button onClick={() => setIndRecords([...indRecords, { id: indRecords.length + 1, arrows: ["未", "未", "未", "未"] }])} className="py-4 bg-gray-800 text-white font-bold rounded-2xl shadow-md">➕ 立を追加</button>
          </div>
          <button onClick={saveIndividual} disabled={isSaving} className="w-full py-5 bg-green-500 text-white text-xl font-bold rounded-2xl shadow-lg active:scale-95 disabled:opacity-50">
            {isSaving ? "送信中..." : "💾 保存してリセット"}
          </button>
        </div>
      )}

      {activeTab === "team" && (
        <div className="animate-fade-in">
          <div className="mb-6 p-5 bg-white rounded-2xl border border-gray-200 shadow-sm">
            <h2 className="font-bold text-gray-700 mb-4">👥 立の編成 (計{totalSize}人)</h2>
            <div className="flex gap-4 mb-6 bg-gray-50 p-3 rounded-xl border border-gray-100">
              <div className="flex-1">
                <label className="block text-[10px] font-bold text-gray-400 mb-1">前射場の人数</label>
                <select value={frontSize} onChange={(e) => updateTeamSizes(parseInt(e.target.value), backSize)} className="w-full p-2 border border-gray-200 rounded-lg font-bold text-blue-600 outline-none">
                  {[0, 1, 2, 3, 4, 5].map(num => <option key={`f-${num}`} value={num}>{num}人</option>)}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-[10px] font-bold text-gray-400 mb-1">後ろ射場の人数</label>
                <select value={backSize} onChange={(e) => updateTeamSizes(frontSize, parseInt(e.target.value))} className="w-full p-2 border border-gray-200 rounded-lg font-bold text-blue-600 outline-none">
                  {[0, 1, 2, 3, 4, 5].map(num => <option key={`b-${num}`} value={num}>{num}人</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-3">
              {teamMembers.map((member, index) => {
                const isFront = index < frontSize;
                const isFirstOfBlock = index === 0 || index === frontSize;
                const localIndex = isFront ? index : index - frontSize;
                const localTotal = isFront ? frontSize : backSize;

                return (
                  <div key={index}>
                    {isFirstOfBlock && (
                      <p className="text-xs font-bold text-blue-500 mt-4 mb-2 border-b-2 border-blue-100 pb-1">
                        {isFront ? "🎯 前射場" : "🎯 後ろ射場"}
                      </p>
                    )}
                    <div className="flex gap-2 items-center bg-gray-50 p-2 rounded-xl">
                      <div className="w-12 text-center text-xs font-black text-white bg-gray-800 py-2 rounded-lg">{getPositionName(localIndex, localTotal)}</div>
                      <select value={member.grade} onChange={(e) => { const newM = [...teamMembers]; newM[index] = { grade: e.target.value, name: "" }; setTeamMembers(newM); }} className="w-20 p-2 bg-white border border-gray-200 rounded-lg text-xs outline-none">
                        {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                      <select value={member.name} onChange={(e) => { const newM = [...teamMembers]; newM[index].name = e.target.value; setTeamMembers(newM); }} className="flex-1 p-2 bg-white border border-gray-200 rounded-lg text-sm outline-none">
                        <option value="">選択...</option>
                        {archers.filter(a => a.grade === member.grade).map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
                      </select>
                    </div>
                  </div>
                );
              })}
              {totalSize === 0 && <p className="text-sm text-gray-400 text-center py-4">人数を選択してください</p>}
            </div>
          </div>

          {totalSize > 0 && (
            <div className="space-y-6 mb-8">
              {teamRounds.map((round, rIndex) => (
                <div key={round.id} className="bg-white p-5 rounded-3xl shadow-sm border border-gray-200 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-2 h-full bg-blue-500"></div>
                  <p className="text-center text-gray-400 text-xs font-black mb-4">{rIndex + 1}立目</p>
                  <div className="space-y-2">
                    {round.arrows.map((personArrows, mIndex) => {
                      const isFront = mIndex < frontSize;
                      const isFirstOfBlock = mIndex === 0 || mIndex === frontSize;
                      const localIndex = isFront ? mIndex : mIndex - frontSize;
                      const localTotal = isFront ? frontSize : backSize;

                      return (
                        <div key={mIndex}>
                          {isFirstOfBlock && (
                            <div className="bg-blue-50 text-blue-600 text-[10px] font-bold px-2 py-1 rounded-md mb-2 mt-4 inline-block">{isFront ? "前射場" : "後ろ射場"}</div>
                          )}
                          <div className="flex items-center gap-3 border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                            <div className="w-16 text-left">
                              <span className="text-[10px] font-bold text-gray-400 block mb-0.5">{getPositionName(localIndex, localTotal)}</span>
                              <span className="font-bold text-gray-700 text-xs truncate block">{teamMembers[mIndex]?.name || "未選択"}</span>
                            </div>
                            <div className="flex gap-2 flex-1 justify-end sm:justify-center">
                              {personArrows.map((state, aIndex) => (
                                <button key={aIndex} onClick={() => toggleTeamArrow(rIndex, mIndex, aIndex)} className={`w-12 h-12 rounded-full text-xl font-bold transition-all active:scale-90 border-4 ${state === "○" ? "bg-red-500 text-white border-red-200" : state === "×" ? "bg-blue-500 text-white border-blue-200" : "bg-gray-100 text-gray-300 border-gray-200"}`}>{state}</button>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 mb-4">
            <button onClick={() => teamRounds.length > 1 && setTeamRounds(teamRounds.slice(0, -1))} className="py-4 bg-white border border-gray-200 text-gray-500 font-bold rounded-2xl shadow-sm">➖ 減らす</button>
            <button onClick={() => setTeamRounds([...teamRounds, { id: teamRounds.length + 1, arrows: Array.from({ length: totalSize }, () => ["未", "未", "未", "未"]) }])} className="py-4 bg-gray-800 text-white font-bold rounded-2xl shadow-md">➕ 立を追加</button>
          </div>
          <button onClick={saveTeam} disabled={isSaving || totalSize === 0} className="w-full py-5 bg-green-500 text-white text-xl font-bold rounded-2xl shadow-lg active:scale-95 disabled:opacity-50">
            {isSaving ? "送信中..." : "💾 全員の記録を保存"}
          </button>
        </div>
      )}

      {/* ==========================================
          📊 分析タブ （年間フィルター ＆ 皆中カウンター追加！）
      ========================================== */}
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
                <option value="">名前を選択して分析...</option>
                {archers.filter(a => a.grade === anaGrade).map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
              </select>
            </div>
          </div>

          {anaArcher && (
            <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
              <div className="bg-gray-800 p-4 sm:p-5 text-white">
                <h2 className="text-lg font-bold mb-4">📊 {anaArcher} さんのデータ</h2>
                <div className="flex flex-col gap-3">
                  
                  {/* フィルターに「年間 (year)」を追加！ */}
                  <div className="flex flex-wrap bg-gray-700 rounded-lg p-1 gap-1">
                    <button onClick={() => setAnaTimeframe("all")} className={`flex-1 min-w-[50px] text-[10px] sm:text-xs py-2 rounded-md font-bold transition-all ${anaTimeframe === "all" ? "bg-blue-500 shadow" : "text-gray-400"}`}>全期間</button>
                    <button onClick={() => setAnaTimeframe("year")} className={`flex-1 min-w-[50px] text-[10px] sm:text-xs py-2 rounded-md font-bold transition-all ${anaTimeframe === "year" ? "bg-blue-500 shadow" : "text-gray-400"}`}>年間</button>
                    <button onClick={() => setAnaTimeframe("month")} className={`flex-1 min-w-[50px] text-[10px] sm:text-xs py-2 rounded-md font-bold transition-all ${anaTimeframe === "month" ? "bg-blue-500 shadow" : "text-gray-400"}`}>今月</button>
                    <button onClick={() => setAnaTimeframe("week")} className={`flex-1 min-w-[50px] text-[10px] sm:text-xs py-2 rounded-md font-bold transition-all ${anaTimeframe === "week" ? "bg-blue-500 shadow" : "text-gray-400"}`}>直近7日</button>
                    <button onClick={() => setAnaTimeframe("custom_month")} className={`flex-1 min-w-[50px] text-[10px] sm:text-xs py-2 rounded-md font-bold transition-all ${anaTimeframe === "custom_month" ? "bg-blue-500 shadow" : "text-gray-400"}`}>月指定</button>
                  </div>
                  
                  {anaTimeframe === "custom_month" && (
                    <div className="bg-gray-700 p-2 rounded-lg flex items-center gap-3">
                      <span className="text-xs font-bold text-gray-300">対象月:</span>
                      <input type="month" value={anaCustomMonth} onChange={(e) => setAnaCustomMonth(e.target.value)} className="bg-gray-600 text-white p-2 rounded border border-gray-500 text-sm outline-none" />
                    </div>
                  )}
                  <div className="flex bg-gray-700 rounded-lg p-1">
                    <button onClick={() => setAnaType("all")} className={`flex-1 text-xs py-2 rounded-md font-bold transition-all ${anaType === "all" ? "bg-green-500 shadow" : "text-gray-400"}`}>すべての記録</button>
                    <button onClick={() => setAnaType("tachi")} className={`flex-1 text-xs py-2 rounded-md font-bold transition-all ${anaType === "tachi" ? "bg-green-500 shadow" : "text-gray-400"}`}>立の記録のみ</button>
                  </div>
                </div>
              </div>

              <div className="p-4 sm:p-6">
                {isLoadingAnalysis ? (
                  <p className="text-center text-gray-400 py-10 font-bold animate-pulse">データを集計中...</p>
                ) : analysisData.total === 0 ? (
                  <p className="text-center text-gray-400 py-10">この条件の記録はありません🏹</p>
                ) : (
                  <div className="space-y-8">
                    <div className="text-center">
                      <p className="text-sm font-bold text-gray-400 mb-1">現在の的中率</p>
                      <p className="text-6xl font-black text-blue-600">
                        {((analysisData.hits / analysisData.total) * 100).toFixed(1)}<span className="text-2xl text-blue-400">%</span>
                      </p>
                      <p className="text-gray-500 font-bold mt-2">{analysisData.hits} 中 / {analysisData.total} 射</p>
                    </div>

                    {/* 🔥 NEW! 皆中〜残念の分布エリア */}
                    <div>
                      <h3 className="text-sm font-bold text-gray-700 border-b border-gray-200 pb-2 mb-4">🎯 的中分布（立ごとの成績）</h3>
                      <div className="grid grid-cols-5 gap-1 sm:gap-2">
                        <div className="bg-red-50 border border-red-100 py-2 px-1 rounded-xl text-center">
                          <p className="text-[10px] sm:text-xs font-black text-red-400 mb-1">皆中</p>
                          <p className="text-sm sm:text-lg font-black text-red-600">{tachiStats.kaichu}<span className="text-[10px] ml-0.5">回</span></p>
                        </div>
                        <div className="bg-orange-50 border border-orange-100 py-2 px-1 rounded-xl text-center">
                          <p className="text-[10px] sm:text-xs font-black text-orange-400 mb-1">三中</p>
                          <p className="text-sm sm:text-lg font-black text-orange-600">{tachiStats.sanchu}<span className="text-[10px] ml-0.5">回</span></p>
                        </div>
                        <div className="bg-green-50 border border-green-100 py-2 px-1 rounded-xl text-center">
                          <p className="text-[10px] sm:text-xs font-black text-green-400 mb-1">二中</p>
                          <p className="text-sm sm:text-lg font-black text-green-600">{tachiStats.nichu}<span className="text-[10px] ml-0.5">回</span></p>
                        </div>
                        <div className="bg-blue-50 border border-blue-100 py-2 px-1 rounded-xl text-center">
                          <p className="text-[10px] sm:text-xs font-black text-blue-400 mb-1">一中</p>
                          <p className="text-sm sm:text-lg font-black text-blue-600">{tachiStats.itchu}<span className="text-[10px] ml-0.5">回</span></p>
                        </div>
                        <div className="bg-gray-50 border border-gray-200 py-2 px-1 rounded-xl text-center">
                          <p className="text-[10px] sm:text-xs font-black text-gray-400 mb-1">残念</p>
                          <p className="text-sm sm:text-lg font-black text-gray-600">{tachiStats.zannen}<span className="text-[10px] ml-0.5">回</span></p>
                        </div>
                      </div>
                    </div>

                    {chartData.length > 0 && (
                      <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200">
                        <p className="text-xs font-bold text-gray-500 mb-4 text-center">的中率の推移</p>
                        <div className="h-48 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                              <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                              <Tooltip contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                              <Line type="monotone" dataKey="的中率(%)" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}

                    <div>
                      <h3 className="text-sm font-bold text-gray-700 border-b border-gray-200 pb-2 mb-4">🏹 立の詳細（矢ごとの的中率）</h3>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        {arrowStats.map((stat, index) => {
                          const rate = stat.total > 0 ? ((stat.hits / stat.total) * 100).toFixed(1) : "0.0";
                          return (
                            <div key={index} className="bg-white border-2 border-gray-100 p-3 rounded-xl text-center relative overflow-hidden">
                              <div className="absolute bottom-0 left-0 h-1 bg-blue-500 transition-all duration-1000" style={{ width: `${rate}%` }}></div>
                              <p className="text-[10px] font-black text-gray-400 mb-1">{index + 1}本目</p>
                              <p className="text-xl font-black text-gray-800">{rate}<span className="text-xs ml-0.5">%</span></p>
                              <p className="text-[10px] text-gray-400 mt-1">{stat.hits}/{stat.total}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 📖 名簿タブ */}
      {activeTab === "members" && (
        <div className="animate-fade-in space-y-6">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-200">
            <h2 className="text-xl font-bold mb-4 text-gray-800">👤 新しいメンバーを登録</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-1">学年</label>
                <select value={newArcherGrade} onChange={(e) => setNewArcherGrade(e.target.value)} className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl font-bold text-blue-600 outline-none">
                  {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-1">名前</label>
                <input type="text" placeholder="例: 山田 太郎" value={newArcherName} onChange={(e) => setNewArcherName(e.target.value)} className="w-full p-4 border border-gray-200 bg-gray-50 rounded-xl outline-none focus:border-blue-500" />
              </div>
              <button onClick={handleAddArcher} className="w-full py-4 bg-blue-500 text-white font-bold rounded-xl shadow-md active:scale-95">
                名簿に登録する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          📅 予定表タブ （画像表示バージョン！）
      ========================================== */}
      {activeTab === "schedule" && (
        <div className="animate-fade-in space-y-6">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-200">
            <h2 className="text-xl font-bold mb-4 text-gray-800">📅 今月の予定表</h2>
            
            {/* ▼ ここで public フォルダの画像を呼び出しています！ ▼ */}
            <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm">
              <img 
                src="/schedule.jpg" 
                alt="今月の予定表" 
                className="w-full h-auto object-contain"
              />
            </div>
            
            <p className="text-center text-[10px] text-gray-400 mt-4 font-bold">
              ※予定が更新されたら、publicフォルダの画像を差し替えるだけでOKです！
            </p>
          </div>
        </div>
      )}

    </main>
  );
}