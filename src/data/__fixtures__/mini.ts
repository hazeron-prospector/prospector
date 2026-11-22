/** Small hand-written, anonymized starmap used by parse/rows/filter tests. */
export const MINI_XML = `<?xml version="1.0" encoding="UTF-8"?>
<starmap empireId="7" empire="House Test" createDate="Sat Nov 21 17:25:58 2026 GMT">
  <galaxy name="Test Galaxy">
    <sector sectorId="SEC1" name="Alpha Sector" x="75" y="1" z="2">
      <system systemId="SYSA" name="Aldera" catalog="XQL'A'B'a" x="754.1" y="11.8" z="9.8" eod="Surveyed">
        <wormhole destX="755.0" destY="12.0" destZ="10.0" destSystemId="SYSB" explored="Yes" polarity="positive"/>
        <wormhole destX="700.0" destY="1.0" destZ="2.5" polarity="negative"/>
        <spacecraft spacecraftId="SC1" name="Wayfarer" ownership="Fleet" structure="Spaceship" empire="House Test" empireId="7" stance="Empire" condition="Green" health="255" moving="no" space="deep" sensors="yes" warpDrive="none" wormholeDrive="none" captain="no" officer="no" new="no"/>
        <spacecraft spacecraftId="SC2" name="Drifter &amp; Co" ownership="Company" structure="Station" condition="Red" health="12" moving="yes" space="system" sensors="no" warpDrive="hot" wormholeDrive="yes" captain="yes" officer="yes" new="yes"/>
        <city cityId="C1" name="Homeport" empire="House Test" empireId="7" stance="Empire" capital="Empire, Galaxy, Sector" admin="Capitol" airport="Airport Terminal"/>
        <city cityId="C2" name="Outpost"/>
        <star starId="STA" name="Aldera Alpha" type="G Yellow" orbit="Primary" size="V Main Sequence" spectralClass="5" surfaceTempK="5,527°K" hab="Habitable Zone at 1.5au" shell="Photosphere" diameter="0.23au Diameter">
          <resource name="Type G Preons" quality="200" abundance="4"/>
          <resource name="Type K Preons" quality="90" abundance="1"/>
        </star>
        <star starId="STB" name="Aldera Beta" type="Neutron Star" orbit="Orbiting Aldera Alpha at 2au 129°" size="" hab="No Habitable Zone - Too Cool" shell="Neutron Sphere" diameter="0.2625au Diameter"/>
        <planet planetId="PA1" name="Aldera I" bodyType="Planet" orbit="Orbiting Aldera Alpha at 1.5au 108°" zone="Habitable Zone">
          <geosphere diameter="15,600m Diameter" gravity="11.89m/s² Sea Level Gravity" resourceZones="4">
            <resource name="Ore" qualityZone1="100" abundanceZone1="2" qualityZone2="150" abundanceZone2="3" qualityZone3="50" abundanceZone3="1" qualityZone4="120" abundanceZone4="9"/>
            <resource name="Stone" qualityZone1="10" abundanceZone1="5" qualityZone2="20" abundanceZone2="6" qualityZone3="30" abundanceZone3="7" qualityZone4="40" abundanceZone4="8"/>
          </geosphere>
          <hydrosphere surfaceLiquid="77% Surface Water">
            <resource name="Myrathane" qualityZone1="130" abundanceZone1="40"/>
          </hydrosphere>
          <atmosphere composition="Exotic, 77% Density">
            <resource name="Air" qualityZone1="154" abundanceZone1="95"/>
          </atmosphere>
          <biosphere fauna="yes" flora="no">
            <resource name="Fruit" qualityZone1="80" abundanceZone1="3" qualityZone2="85" abundanceZone2="4" qualityZone3="60" abundanceZone3="1" qualityZone4="70" abundanceZone4="2"/>
          </biosphere>
        </planet>
        <planet planetId="PA2" name="Aldera I-a" bodyType="Moon" orbit="Orbiting Aldera I at 83,400m 257°" zone="Habitable Zone">
          <geosphere diameter="1,800m Diameter" gravity="1.37m/s² Sea Level Gravity" resourceZones="1">
            <resource name="Ore" qualityZone1="180" abundanceZone1="1"/>
          </geosphere>
          <hydrosphere surfaceLiquid="No Surface Liquid"/>
          <atmosphere composition="No Atmosphere"/>
        </planet>
        <planet planetId="PA3" name="Aldera II" bodyType="Gas Giant" orbit="Orbiting Aldera Alpha at 5au 3°" zone="Outer Zone">
          <geosphere diameter="6000m Diameter" gravity="5548.88m/s² Core Gravity" resourceZones="2">
            <resource name="Ore" qualityZone1="131" abundanceZone1="1" qualityZone2="99" abundanceZone2="2"/>
          </geosphere>
          <hydrosphere surfaceLiquid="100% Surface Liquid" diameter="64000m Diameter" gravity="48.77m/s² Sea Level Gravity">
            <resource name="Flomentum" qualityZone1="135" abundanceZone1="8"/>
          </hydrosphere>
          <atmosphere composition="Exotic, 95% Density"/>
        </planet>
        <planet planetId="PA4" name="Aldera IIr" bodyType="Ring" orbit="Orbiting Aldera II at 54,700m 63°" zone="Outer Zone">
          <geosphere diameter="54700m Radius&lt;br&gt;15200m Width" resourceZones="1">
            <resource name="Ice" qualityZone1="145" abundanceZone1="1"/>
          </geosphere>
        </planet>
      </system>
      <system systemId="SYSB" name="Bellum" x="755.0" y="12.0" z="10.0" eod="Explored">
        <star starId="STC" name="Bellum" type="M Red" orbit="Primary" size="D Dwarf" surfaceTempK="3,546°K" hab="No Habitable Zone - Too Cool" shell="Photosphere" diameter="0.15au Diameter"/>
        <planet planetId="PB1" name="Bellum I" bodyType="Planetoid" orbit="Orbiting Bellum at 0.25au 227°" zone="Inferno Zone">
          <geosphere diameter="1,600m Diameter" gravity="1.22m/s² Sea Level Gravity" resourceZones="1"/>
          <hydrosphere surfaceLiquid="No Surface Liquid"/>
          <atmosphere composition="No Atmosphere"/>
        </planet>
      </system>
    </sector>
    <sector sectorId="SEC2" name="Beta Sector" x="76" y="1" z="2">
      <system systemId="SYSC" name="Cirrus" x="760.0" y="1.0" z="1.0" eod="Unexplored">
        <star starId="STD" name="Cirrus" type="F Yellow White" orbit="Primary" size="V Main Sequence" spectralClass="4" surfaceTempK="6,755°K" hab="Habitable Zone at 1.5au" shell="Photosphere" diameter="0.23au Diameter"/>
      </system>
      <system systemId="SYSD" name="Deep Space" eod="Unexplored"/>
    </sector>
  </galaxy>
</starmap>
`
